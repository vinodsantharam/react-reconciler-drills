import { ReactNode, createContext } from "react";
import Reconciler, { OpaqueRoot } from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { instrument } from "./instrument";

const HostConfig = {
  appendInitialChild(parentInstance, children: any) {
    parentInstance.children.push(children);
  },
  createTextInstance(text, rootContainer, hostContext, internalHandle) {
    return { text };
  },
  createInstance(
    type: ReactNode,
    props: any,
    rootContainerInstance: any,
    hostContext: any,
    internalInstanceHandle: any,
  ) {
    if (type === "box") {
      const { children, ...rest } = props;
      return { type, props: { ...rest }, children: [] };
    }
    if (type === "leaf") {
      const { children, ...rest } = props;
      return { type, props: { ...rest }, children: [{ text: props.children }] };
    }
    if (type === "item") {
      return { type, id: props.id };
    }
    throw new Error(`Unknown type: ${type}`);
  },
  supportsMutation: true,
  appendChild(parent: any, child: any) {
    parent.children.push(child);
  },

  // ---- Placeholders: setup methods React requires but drill 1 doesn't use. ----

  // Host context: nothing to pass down the tree.
  getRootHostContext: () => ({}),
  getChildHostContext: (parentHostContext: any) => parentHostContext,

  // Commit hooks: nothing to do before or after a commit (yet).
  prepareForCommit: () => null,
  resetAfterCommit: () => {},
  finalizeInitialChildren: () => false, // false = no commitMount call needed
  preparePortalMount: () => {},
  detachDeletedInstance: () => {},

  // What refs point to: the host object itself.
  getPublicInstance: (instance: any) => instance,

  // Scheduling: let React use the platform's timers.
  isPrimaryRenderer: true,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,

  // Update priority: React stores the current priority here and reads it back.
  // When nothing is set (0), fall back to the default priority.
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,

  // Events: there are none, so no type and no timestamp.
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  trackSchedulerEvent: () => {},

  // Transitions and Suspense: not used in drill 1.
  shouldAttemptEagerTransition: () => false,
  requestPostPaintCallback: () => {},
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),
  resetFormInstance: () => {},

  // DOM-specific hooks React calls on every renderer.
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,

  clearContainer: (container: OpaqueRoot) => {
    container.children.length = 0;
  },
  shouldSetTextContent: (type: ReactNode, props: any) => {
    if (type === "box" && typeof props.children === "string") {
      return true;
    }
    else if (type === "leaf" && typeof props.children === "string") {
      return true;
    }
    return false;
  },

  appendChildToContainer: (container: OpaqueRoot, child: any) => {
    container.children.push(child);
  },

  // Props changed on an existing element: update it in place instead of recreating it.
  // React calls this even when only `children` changed (the outer box in Toggle), so
  // strip children the same way createInstance does.
  commitUpdate: (instance: any, type: ReactNode, oldProps: any, newProps: any) => {
    const { children, ...rest } = newProps;
    instance.props = rest;
  },

  // Same as removeChildFromContainer, but for a child inside another host element
  // (here: the "maybe" box inside the outer box when Toggle's show becomes false).
  removeChild: (parent: any, child: any) => {
    const index = parent.children.indexOf(child);
    if (index !== -1) {
      parent.children.splice(index, 1);
    }
  },

  removeChildFromContainer: (container: OpaqueRoot, child: any) => {
    const index = container.children.indexOf(child);
    if (index !== -1) {
      container.children.splice(index, 1);
    }
  }
};

let currentUpdatePriority = 0;

const reconciler = Reconciler(instrument(HostConfig));

// One React root per container, kept between render() calls. The root holds the
// previous tree, which React needs in order to diff instead of mounting from scratch.
// Like ReactDOM: createRoot(node) once, then root.render(...) many times.
// A WeakMap lets a container (and its root) be garbage-collected once it's unused.
const roots = new WeakMap<object, OpaqueRoot>();

export function render(element: React.ReactNode, container: object): void {
  let root = roots.get(container);
  if (!root) {
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
