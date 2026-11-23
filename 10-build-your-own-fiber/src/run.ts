// Runs a scenario on your reconciler or on the real one, and records the container's
// tree and the host calls after each step. Used by compare.test.tsx and compare.ts.

import * as React from "react";
import { createElement, type MiniNode } from "./element";
import { createReconciler, useState } from "./reconciler";
import { makeDemos } from "./demo";
import { createTestScheduler } from "./scheduler";
import { instrument, type CallLog } from "./instrument";
import { objectTreeHost, type Container } from "./host-config";
import { createRealRoot } from "./real";
import { describeCalls, type Scenario } from "./scenarios";

export type StepResult = { label: string; tree: Container; calls: string[] };

export function runMini(scenario: Scenario): StepResult[] {
  const container: Container = { children: [] };
  const log: CallLog = [];
  const scheduler = createTestScheduler();
  const reconciler = createReconciler(instrument(objectTreeHost, log, { print: false }), scheduler);
  const root = reconciler.createContainer(container);
  const d = makeDemos({ h: createElement, useState });

  return scenario.steps.map((step) => {
    log.length = 0;
    if ("render" in step) reconciler.updateContainer(step.render({ h: createElement, d }) as MiniNode, root);
    else step.act(d);
    scheduler.flushAll();
    return { label: step.label, tree: structuredClone(container), calls: describeCalls(log) };
  });
}

export function runReal(scenario: Scenario): StepResult[] {
  const container: Container = { children: [] };
  const log: CallLog = [];
  const root = createRealRoot(instrument(objectTreeHost, log, { print: false }), container);
  const d = makeDemos({ h: React.createElement, useState: React.useState });

  return scenario.steps.map((step) => {
    log.length = 0;
    if ("render" in step) root.render(step.render({ h: React.createElement, d }) as React.ReactNode);
    else root.act(() => step.act(d));
    return { label: step.label, tree: structuredClone(container), calls: describeCalls(log) };
  });
}

