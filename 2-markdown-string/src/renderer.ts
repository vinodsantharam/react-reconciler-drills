// Drill 2: render a React tree to a Markdown string.
// The contract is described at the top of renderer.test.tsx. Everything below is yours to write.

import { ReactNode, createContext } from "react";
import Reconciler, { OpaqueRoot } from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { instrument } from "./instrument";

export type Container = {
  // The whole document as Markdown, updated after every commit.
  output: string;
  // Called once per commit with the new output.
  onChange?: (output: string) => void;
};

// ---- The tree: same shape as drill 1. ----
type TextNode = { text: string };
type ElementNode = {
  type: string;
  props: Record<string, unknown>;
  children: TreeNode[];
};
type TreeNode = ElementNode | TextNode;

// What the renderer keeps on the container: the top-level nodes, like drill 1's
// `{ children: [] }`. The Markdown string is computed FROM this list, in resetAfterCommit.
type HostContainer = Container & { children: TreeNode[] };

const HostConfig = {
  supportsMutation: true,

  resolveEventTimeStamp: () => -1.1,
  resolveEventType: () => null,
  trackSchedulerEvent: () => null,
  getRootHostContext: () => ({}),
  getChildHostContext: () => ({}),
  getCurrentUpdatePriority: () => currentUpdatePriority,
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  finalizeInitialChildren: () => false,
  detachDeletedInstance: () => {},

  // ---- Job 1: keep the tree up to date. No Markdown in here. ----

  createInstance(type: string, props: any): ElementNode {
    if (
      type === "heading" ||
      type === "paragraph" ||
      type === "divider" ||
      type === "codeBlock" ||
      type === "bold" ||
      type === "italic" ||
      type === "inlineCode" ||
      type === "anchor"
    ) {
      const { children, ...rest } = props;
      return { type, props: rest, children: [] };
    }
    throw new Error(`Unknown type: ${type}`);
  },
  createTextInstance(text: string): TextNode {
    return { text };
  },
  shouldSetTextContent(_type: string, _props: unknown) {
    return false;
  },
  appendInitialChild(parent: ElementNode, child: TreeNode) {
    parent.children.push(child);
  },
  appendChild(parent: ElementNode, child: TreeNode) {
    const oldIndex = parent.children.indexOf(child);
    if (oldIndex !== -1) {
      parent.children.splice(oldIndex, 1);
    }
    parent.children.push(child);
  },

  // Container methods change the container's list of top-level nodes, exactly like
  // appendChild does for an element. Before: this built the string here, so later
  // commits (updates, removals) never changed it.
  appendChildToContainer(container: HostContainer, child: TreeNode) {
    const oldIndex = container.children.indexOf(child);
    if (oldIndex !== -1) {
      container.children.splice(oldIndex, 1);
    }
    container.children.push(child);
  },
  clearContainer(container: HostContainer) {
    container.children = [];
  },

  commitUpdate(
    instance: ElementNode,
    _type: string,
    _oldProps: unknown,
    newProps: any,
  ) {
    const { children, ...rest } = newProps;
    instance.props = rest;
  },
  commitTextUpdate(textInstance: TextNode, _oldText: string, newText: string) {
    textInstance.text = newText;
  },

  // ---- Job 2: turn the whole tree into Markdown, once per commit. ----

  prepareForCommit: () => null,
  // Runs once after ALL of a commit's changes are applied, so the tree is complete
  // and correct here, whatever happened in this commit (mount, update, removal...).
  resetAfterCommit(container: HostContainer) {
    container.output = toMarkdown(container);
    container.onChange?.(container.output);
  },
};

// Walks the container's top-level nodes. Each block's code is your original
// toMarkdown, unchanged: it only knows headings for now.
function toMarkdown(container: HostContainer): string {
  if (container.children.length === 0) {
    return "";
  } else if (container.children.length === 1) {
    return container.children.map(blockToMarkdown) + "\n";
  }
  const len = container.children.length;
  return container.children
    .map((item, index) => {
      const block = blockToMarkdown(item);
      if (index === 0) {
        return block + "\n";
      }
      return "\n" + block + "\n";
    })
    .join("");
}

function blockToMarkdown(node: TreeNode): string {
  let content = "";
  if ("type" in node && node.type === "heading") {
    const prefix = "#".repeat(node.props.level as number);
    content += `${prefix} ${node.children.map(inlineToMarkdown).join("")}`;
  }

  if ("type" in node && node.type === "paragraph") {
    content += node.children.map(inlineToMarkdown).join("");
  }

  if ("type" in node && node.type === "divider") {
    content += "---";
  }

  if ("type" in node && node.type === "codeBlock") {
    if (node.props.language) {
      content += `\`\`\`${node.props.language}\n${node.children.map((child) => (child as TextNode).text).join("")}\n\`\`\``;
    } else {
      content += `\`\`\`\n${node.children.map((child) => (child as TextNode).text).join("")}\n\`\`\``;
    }
  }

  return content;
}

// Inline content: text, or an inline element wrapping more inline content.
// Recursion: an element's inner Markdown is its children's Markdown, joined.
// Put a backslash before every character Markdown would read as syntax:
// \ * _ ` [ ]. The backslash itself is in the list, otherwise "a\b" would be ambiguous.
// One regex pass, so a backslash we add is never escaped again.
function escapeMarkdown(text: string): string {
  return text.replace(/[\\*_`[\]]/g, (char) => "\\" + char);
}

function inlineToMarkdown(node: TreeNode): string {
  if ("text" in node) {
    return escapeMarkdown(node.text);
  }
  const inner = node.children.map(inlineToMarkdown).join("");
  switch (node.type) {
    case "bold":
      return `**${inner}**`;
    case "italic":
      return `_${inner}_`;
    case "inlineCode":
      return `\`${inner}\``;
    case "anchor":
      return `[${inner}](${node.props.href})`;
    default:
      throw new Error(`<${node.type}> is not inline content`);
  }
}

let currentUpdatePriority = 0;

const reconciler = Reconciler(instrument(HostConfig as any));

// One React root per container, kept between render() calls. The root holds the
// previous tree, which React needs in order to diff instead of mounting from scratch.
// Like ReactDOM: createRoot(node) once, then root.render(...) many times.
// A WeakMap lets a container (and its root) be garbage-collected once it's unused.
const roots = new WeakMap<object, OpaqueRoot>();

export function render(element: ReactNode, container: Container): void {
  let root = roots.get(container);
  if (!root) {
    // The caller's container only has `output`. Give it a place for the tree.
    (container as HostContainer).children = [];
    root = createRoot(container);
    roots.set(container, root);
  }

  // updateContainer only schedules the render for later. The sync variant queues it
  // at sync priority, and flushSyncWork runs that queued work before returning.
  reconciler.updateContainerSync(element, root, null, null);
  reconciler.flushSyncWork();
}

function createRoot(container: object): OpaqueRoot {
  return reconciler.createContainer(
    container,
    0,
    null,
    true,
    null,
    "#-",
    (e) => {
      console.error(e);
    },
    (e) => {
      console.error(e);
    },
    (e) => {
      console.error(e);
    },
    () => {},
    null,
  );
}
