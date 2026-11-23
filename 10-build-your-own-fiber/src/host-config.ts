// The host side of the contract, seen from the other end this time.
//
// `HostConfig` is the subset of react-reconciler's host config that your mini
// reconciler calls. The names and argument orders match react-reconciler 0.34, so a
// log of your calls can be compared line by line with a log of the real ones
// (`npm run compare`). Your reconciler decides WHEN to call each method; the host
// only does what it's told.
//
// `objectTreeHost` is your drill 1 host config, trimmed to these methods. The
// "screen" is a plain object tree: elements are { type, props, children } with
// `children` left out of props, and text is { text }.

export type Props = Record<string, unknown>;
export type Container = { children: HostNode[] };
export type Instance = { type: string; props: Props; children: HostNode[] };
export type TextInstance = { text: string };
export type HostNode = Instance | TextInstance;
export type HostContext = unknown;

export interface HostConfig {
  // ---- Render phase: may run many times, may be thrown away. No visible changes. ----

  // Host context flows DOWN the tree: the root's value, then one per host element.
  getRootHostContext(container: Container): HostContext;
  getChildHostContext(parentContext: HostContext, type: string): HostContext;
  // true = the element holds its text itself, so don't create text children for it.
  shouldSetTextContent(type: string, props: Props): boolean;

  // `fiber` is react-reconciler's `internalInstanceHandle`: whatever object your
  // reconciler uses to represent this node. The host may keep it, but must not use it.
  createInstance(
    type: string,
    props: Props,
    container: Container,
    hostContext: HostContext,
    fiber: unknown,
  ): Instance;
  createTextInstance(
    text: string,
    container: Container,
    hostContext: HostContext,
    fiber: unknown,
  ): TextInstance;
  // Builds a detached subtree, before anything is on screen.
  appendInitialChild(parent: Instance, child: HostNode): void;
  // Called once an instance has all its initial children. Return true to get a
  // commitMount call later (this drill never needs one: always false here).
  finalizeInitialChildren(
    instance: Instance,
    type: string,
    props: Props,
    hostContext: HostContext,
  ): boolean;

  // ---- Commit phase: runs once per finished render, never interrupted. ----

  prepareForCommit(container: Container): unknown;
  resetAfterCommit(container: Container): void;
  clearContainer(container: Container): void;

  appendChildToContainer(container: Container, child: HostNode): void;
  insertInContainerBefore(container: Container, child: HostNode, beforeChild: HostNode): void;
  removeChildFromContainer(container: Container, child: HostNode): void;

  // appendChild and insertBefore are also how a MOVE is done (keyed reorder).
  appendChild(parent: Instance, child: HostNode): void;
  insertBefore(parent: Instance, child: HostNode, beforeChild: HostNode): void;
  removeChild(parent: Instance, child: HostNode): void;

  commitUpdate(
    instance: Instance,
    type: string,
    oldProps: Props,
    newProps: Props,
    fiber: unknown,
  ): void;
  commitTextUpdate(textInstance: TextInstance, oldText: string, newText: string): void;
}

// ---- Your drill 1 host config, trimmed. Unchanged logic. ----

function withoutChildren(props: Props): Props {
  const { children, ...rest } = props;
  return rest;
}

function removeFrom(children: HostNode[], child: HostNode) {
  const index = children.indexOf(child);
  if (index !== -1) children.splice(index, 1);
}

function insertInto(children: HostNode[], child: HostNode, beforeChild: HostNode) {
  removeFrom(children, child);
  children.splice(children.indexOf(beforeChild), 0, child);
}

export const objectTreeHost: HostConfig = {
  getRootHostContext: () => ({}),
  getChildHostContext: (parentContext) => parentContext,
  shouldSetTextContent: () => false,

  createInstance(type, props) {
    if (type !== "box" && type !== "leaf" && type !== "item") {
      throw new Error(`Unknown type: ${type}`);
    }
    return { type, props: withoutChildren(props), children: [] };
  },
  createTextInstance: (text) => ({ text }),
  appendInitialChild(parent, child) {
    parent.children.push(child);
  },
  finalizeInitialChildren: () => false,

  prepareForCommit: () => null,
  resetAfterCommit: () => {},
  clearContainer(container) {
    container.children.length = 0;
  },

  appendChildToContainer(container, child) {
    removeFrom(container.children, child);
    container.children.push(child);
  },
  insertInContainerBefore(container, child, beforeChild) {
    insertInto(container.children, child, beforeChild);
  },
  removeChildFromContainer(container, child) {
    removeFrom(container.children, child);
  },

  appendChild(parent, child) {
    removeFrom(parent.children, child);
    parent.children.push(child);
  },
  insertBefore(parent, child, beforeChild) {
    insertInto(parent.children, child, beforeChild);
  },
  removeChild(parent, child) {
    removeFrom(parent.children, child);
  },

  commitUpdate(instance, _type, _oldProps, newProps) {
    instance.props = withoutChildren(newProps);
  },
  commitTextUpdate(textInstance, _oldText, newText) {
    textInstance.text = newText;
  },
};
