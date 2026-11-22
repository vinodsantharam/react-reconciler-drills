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
// `raw`: the text sits inside inlineCode or codeBlock, so it's never escaped.
// It's decided once, when React creates the text node, from the host context.
type TextNode = { text: string; raw: boolean };
type ElementNode = {
  type: string;
  props: Record<string, unknown>;
  children: TreeNode[];
};
type TreeNode = ElementNode | TextNode;

// What the renderer keeps on the container: the top-level nodes, like drill 1's
// `{ children: [] }`. The Markdown string is computed FROM this list, in resetAfterCommit.
type HostContainer = Container & { children: TreeNode[] };

// ---- Host context: "what kind of place am I in?" ----
// React passes this DOWN the tree during the render phase. getRootHostContext gives
// the top level's value; getChildHostContext(parentContext, type) gives the value for
// the children of an element of `type`. createInstance and createTextInstance receive
// the context of the place they're being created in, so they can refuse what doesn't
// belong there. react-dom uses the same mechanism to know it's inside an <svg>.
type HostContext =
  | "root" //     top level: blocks only
  | "inline" //   inside heading, paragraph, bold, italic, anchor: text + inline elements
  | "listItem" // like inline, plus a nested list
  | "list" //     listItem only
  | "raw" //      inside codeBlock, inlineCode: text only, never escaped
  | "empty"; //   inside divider: nothing

const BLOCKS = ["heading", "paragraph", "list", "codeBlock", "divider"];
const INLINES = ["bold", "italic", "inlineCode", "anchor"];

function contextForChildrenOf(type: string): HostContext {
  switch (type) {
    case "list":
      return "list";
    case "listItem":
      return "listItem";
    case "codeBlock":
    case "inlineCode":
      return "raw";
    case "divider":
      return "empty";
    default:
      return "inline";
  }
}

function isElementAllowed(context: HostContext, type: string): boolean {
  switch (context) {
    case "root":
      return BLOCKS.includes(type);
    case "inline":
      return INLINES.includes(type);
    case "listItem":
      return INLINES.includes(type) || type === "list";
    case "list":
      return type === "listItem";
    default:
      return false; // raw and empty hold no elements
  }
}

function isTextAllowed(context: HostContext): boolean {
  return context === "inline" || context === "listItem" || context === "raw";
}

const HostConfig = {
  supportsMutation: true,

  resolveEventTimeStamp: () => -1.1,
  resolveEventType: () => null,
  trackSchedulerEvent: () => null,
  getRootHostContext: (): HostContext => "root",
  getChildHostContext: (_parentContext: HostContext, type: string): HostContext =>
    contextForChildrenOf(type),
  getCurrentUpdatePriority: () => currentUpdatePriority,
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  finalizeInitialChildren: () => false,
  detachDeletedInstance: () => {},

  // ---- Job 1: keep the tree up to date. No Markdown in here. ----

  // hostContext describes the place this element is being created in (its parent).
  createInstance(
    type: string,
    props: any,
    _container: HostContainer,
    hostContext: HostContext,
  ): ElementNode {
    if (!BLOCKS.includes(type) && !INLINES.includes(type) && type !== "listItem") {
      throw new Error(`Unknown type: ${type}`);
    }
    if (!isElementAllowed(hostContext, type)) {
      throw new Error(`<${type}> is not allowed here (${hostContext})`);
    }
    const { children, ...rest } = props;
    return { type, props: rest, children: [] };
  },
  // Same idea for text. React creates text nodes on updates too (test 36), so the
  // check runs whenever new text appears, not only on the first render.
  createTextInstance(
    text: string,
    _container: HostContainer,
    hostContext: HostContext,
  ): TextNode {
    if (!isTextAllowed(hostContext)) {
      throw new Error(`Text "${text}" is not allowed here (${hostContext})`);
    }
    return { text, raw: hostContext === "raw" };
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

  // ---- Removing and inserting: same as drill 1, for elements and for the container. ----

  removeChild(parent: ElementNode, child: TreeNode) {
    removeFrom(parent.children, child);
  },
  removeChildFromContainer(container: HostContainer, child: TreeNode) {
    removeFrom(container.children, child);
  },
  // Can be a MOVE (keyed reorder): take the child out first, THEN find beforeChild,
  // because removing the child can shift beforeChild's index down by one.
  insertBefore(parent: ElementNode, child: TreeNode, beforeChild: TreeNode) {
    insertInto(parent.children, child, beforeChild);
  },
  insertInContainerBefore(container: HostContainer, child: TreeNode, beforeChild: TreeNode) {
    insertInto(container.children, child, beforeChild);
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

  if ("type" in node && node.type === "list") {
    content += listToLines(node).join("\n");
  }

  return content;
}

// One line per item: marker + the item's inline content. A nested list inside an
// item becomes more lines, each indented by this item's marker width ("- " = 2,
// "1. " = 3). Recursion handles any depth: a nested list's lines already carry their
// own indentation, and we add ours on top.
function listToLines(list: ElementNode): string[] {
  const lines: string[] = [];
  list.children.forEach((item, index) => {
    const marker = list.props.ordered ? `${index + 1}. ` : "- ";
    const children = (item as ElementNode).children;
    const isList = (child: TreeNode) => "type" in child && child.type === "list";

    lines.push(marker + children.filter((c) => !isList(c)).map(inlineToMarkdown).join(""));
    for (const nested of children.filter(isList)) {
      const indent = " ".repeat(marker.length);
      lines.push(...listToLines(nested as ElementNode).map((line) => indent + line));
    }
  });
  return lines;
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
    return node.raw ? node.text : escapeMarkdown(node.text);
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

// Shared by the element and container versions: both just edit a children array.
function removeFrom(children: TreeNode[], child: TreeNode) {
  const index = children.indexOf(child);
  if (index !== -1) {
    children.splice(index, 1);
  }
}

function insertInto(children: TreeNode[], child: TreeNode, beforeChild: TreeNode) {
  removeFrom(children, child);
  children.splice(children.indexOf(beforeChild), 0, child);
}

let currentUpdatePriority = 0;

const reconciler = Reconciler(instrument(HostConfig as any));

// One React root per container, kept between render() calls. The root holds the
// previous tree, which React needs in order to diff instead of mounting from scratch.
// Like ReactDOM: createRoot(node) once, then root.render(...) many times.
// A WeakMap lets a container (and its root) be garbage-collected once it's unused.
// Each root also keeps the errors React reported during the last render() call.
const roots = new WeakMap<object, { root: OpaqueRoot; errors: unknown[] }>();

export function render(element: ReactNode, container: Container): void {
  let entry = roots.get(container);
  if (!entry) {
    // The caller's container only has `output`. Give it a place for the tree.
    (container as HostContainer).children = [];
    const errors: unknown[] = [];
    entry = { root: createRoot(container, errors), errors };
    roots.set(container, entry);
  }

  // updateContainer only schedules the render for later. The sync variant queues it
  // at sync priority, and flushSyncWork runs that queued work before returning.
  entry.errors.length = 0;
  reconciler.updateContainerSync(element, entry.root, null, null);
  reconciler.flushSyncWork();

  // React CATCHES errors thrown by components and by the host config; it never lets
  // them escape updateContainerSync. With no error boundary, it unmounts the root and
  // hands the error to onUncaughtError. We collected it there; rethrow it here so
  // render() fails the way the contract says.
  if (entry.errors.length > 0) {
    throw entry.errors[0];
  }
}

function createRoot(container: object, errors: unknown[]): OpaqueRoot {
  return reconciler.createContainer(
    container,
    0,
    null,
    true,
    null,
    "#-",
    // onUncaughtError: no error boundary caught it.
    (e) => {
      errors.push(e);
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
