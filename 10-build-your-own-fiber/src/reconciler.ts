// Drill 10: build your own Fiber. You are the reconciler now.
// The contract is described at the top of reconciler.test.tsx. Everything below is yours.
//
// The shape of the API copies react-reconciler, so drills 1–9 and this one meet in
// the middle:
//
//   const reconciler = createReconciler(objectTreeHost, scheduler);
//   const root = reconciler.createContainer(container);
//   reconciler.updateContainer(<App />, root);   // schedules; nothing happens yet
//   scheduler.flushAll();                         // render phase, then commit
//
// Suggested order (each step has its own block of tests):
//   1. createElement (element.ts).
//   2. Mount: a fiber per element, a work loop, then one commit.
//   3. Interruptible rendering: yield to the scheduler between units of work.
//   4. Updates: diff against the previous tree, reuse host instances.
//   5. Keys: match children by key, move instead of recreate.
//   6. useState: hooks stored on the fiber, updates scheduled through the root.
//   7. Stretch: make your host call log match the real reconciler's.

import type { MiniNode } from "./element";
import type { Container, HostConfig } from "./host-config";
import type { Scheduler } from "./scheduler";

// Yours to design. See NOTES.md for the questions worth answering first.
export type Fiber = unknown;

// What createContainer returns: everything the reconciler keeps for one container.
// react-reconciler calls it a FiberRoot.
export type Root = unknown;

export type Reconciler = {
  createContainer(container: Container): Root;
  updateContainer(element: MiniNode, root: Root): void;
};

export function createReconciler(host: HostConfig, scheduler: Scheduler): Reconciler {
  return {
    createContainer(container) {
      throw new Error("createContainer: not implemented");
    },
    updateContainer(element, root) {
      throw new Error("updateContainer: not implemented");
    },
  };
}

export type SetState<S> = (action: S | ((previous: S) => S)) => void;

export function useState<S>(initial: S): [S, SetState<S>] {
  throw new Error("useState: not implemented");
}
