// The real react-reconciler, driving the same host. This is the yardstick: whatever
// your reconciler does to the host, compare it with what this does.
//
// Tooling, not part of the drill. It's your drill 1 root code plus the placeholder
// methods react-reconciler insists on.

import { createContext, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import { ConcurrentRoot, DefaultEventPriority } from "react-reconciler/constants.js";
import type { Container, HostConfig } from "./host-config";

export type RealRoot = {
  // Synchronous, like drill 1's render().
  render(element: ReactNode): void;
  // Runs `fn` (which calls setState) and flushes the resulting render and commit.
  act(fn: () => void): void;
};

export function createRealRoot(host: HostConfig, container: Container): RealRoot {
  let currentUpdatePriority = 0;

  // Spread `host` LAST so its methods (possibly instrumented) win.
  const config = {
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,
    getPublicInstance: (instance: unknown) => instance,
    preparePortalMount: () => {},
    detachDeletedInstance: () => {},
    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    noTimeout: -1,
    supportsMicrotasks: true,
    scheduleMicrotask: queueMicrotask,
    setCurrentUpdatePriority: (priority: number) => {
      currentUpdatePriority = priority;
    },
    getCurrentUpdatePriority: () => currentUpdatePriority,
    resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,
    resolveEventType: () => null,
    resolveEventTimeStamp: () => -1.1,
    trackSchedulerEvent: () => {},
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
    getInstanceFromNode: () => null,
    beforeActiveInstanceBlur: () => {},
    afterActiveInstanceBlur: () => {},
    prepareScopeUpdate: () => {},
    getInstanceFromScope: () => null,
    hideInstance: () => {},
    unhideInstance: () => {},
    hideTextInstance: () => {},
    unhideTextInstance: () => {},
    commitMount: () => {},
    resetTextContent: () => {},
    // Each method is looked up on `host` at call time, so an instrumented host
    // (a Proxy) still sees every call.
    ...Object.fromEntries(
      Object.keys(host).map((name) => [
        name,
        (...args: unknown[]) => (host as any)[name](...args),
      ]),
    ),
  };

  const reconciler = Reconciler(config as any);
  // React catches render errors and reports them here; render() and act() rethrow them.
  const errors: unknown[] = [];
  const root = reconciler.createContainer(
    container,
    ConcurrentRoot,
    null,
    false, // no strict mode: your reconciler doesn't double-render either
    null,
    "",
    (error) => errors.push(error),
    (error) => console.error(error),
    (error) => console.error(error),
    () => {},
    null,
  );

  return {
    render(element) {
      errors.length = 0;
      reconciler.updateContainerSync(element, root, null, null);
      reconciler.flushSyncWork();
      if (errors.length > 0) throw errors[0];
    },
    act(fn) {
      errors.length = 0;
      reconciler.flushSyncFromReconciler(fn);
      if (errors.length > 0) throw errors[0];
    },
  };
}
