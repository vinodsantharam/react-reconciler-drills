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

const HostConfig = {
  
  resolveEventTimeStamp: () => -1.1,
  resolveEventType: () => null,
  updateContainerSync: (element: ReactNode, container: Container, parentComponent: any, callback: any) => {
    reconciler.updateContainer(element, container, parentComponent, callback);
  },
  getRootHostContext: () => ({}),
  getCurrentUpdatePriority: () => currentUpdatePriority,
  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  prepareForCommit: () => null,
  trackSchedulerEvent: () => null,
  resetAfterCommit: (container: Container) => {
    container.onChange?.(container.output);
  },
  appendInitialChild(parentInstance: { children: any[]; }, children: any) {
    parentInstance.children.push(children);
  },
  commitUpdate(instance: any, updatePayload: any, type: any, oldProps: any, newProps: any, internalHandle: any) {
    instance.props = newProps;
  },
}



let currentUpdatePriority = 0;

const reconciler = Reconciler(instrument(HostConfig));

// One React root per container, kept between render() calls. The root holds the
// previous tree, which React needs in order to diff instead of mounting from scratch.
// Like ReactDOM: createRoot(node) once, then root.render(...) many times.
// A WeakMap lets a container (and its root) be garbage-collected once it's unused.
const roots = new WeakMap<object, OpaqueRoot>();

export function render(element: ReactNode, container: Container): void {
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
