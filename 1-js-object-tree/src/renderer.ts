import { ReactNode, createContext } from "react";
import Reconciler, { OpaqueRoot } from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { instrument } from "./instrument";

const HostConfig = {
  appendInitialChild(parentInstance, children: any) {
    parentInstance.children.push(children);
  },
  createTextInstance(text, rootContainer, hostContext, internalHandle) {},
  createInstance(
    type: ReactNode,
    props: any,
    rootContainerInstance: any,
    hostContext: any,
    internalInstanceHandle: any,
  ) {
    if (type === "box") {
      return { type, props: { id: props.id }, children: [] };
    }
    if (type === "leaf") {
      return { type, count: props.count };
    }
    if (type === "item") {
      return { type, id: props.id };
    }
    throw new Error(`Unknown type: ${type}`);
  },
  supportsMutation: true,
  appendChild(parent: any, child: any) {

    parent.children.push((child));
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
    return type === "box" && typeof props.children === "string";
  },

  appendChildToContainer: (container: OpaqueRoot, child: any) => {
    container.children.push(child);
  },
};

let currentUpdatePriority = 0;

const reconciler = Reconciler(instrument(HostConfig));

export function render(element: React.ReactNode, container: Object): void {
  const containerInstance: OpaqueRoot = reconciler.createContainer(
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

  // updateContainer only schedules the render for later. The sync variant queues it
  // at sync priority, and flushSyncWork runs that queued work before returning.
  reconciler.updateContainerSync(element, containerInstance, null, null);
  reconciler.flushSyncWork();
}
