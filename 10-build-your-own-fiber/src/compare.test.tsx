// Your reconciler next to the real one, on the same host and the same components.
//
// "same result": after every step, both containers hold the same tree. Required.
// "stretch: same host calls": the filtered call logs match line by line. Only
// possible once your reconciler follows React's own algorithms (bottom-up
// completeWork, React's keyed diff with lastPlacedIndex, getHostSibling, bailouts
// for components with no pending work...). Use `npm run compare` to see both logs.

import { runMini, runReal } from "./run";
import { scenarios } from "./scenarios";

describe("same result as react-reconciler", () => {
  test.each(scenarios.map((s) => [s.name, s] as const))("%s", (_name, scenario) => {
    const real = runReal(scenario);
    const mini = runMini(scenario);
    expect(mini.map(({ label, tree }) => ({ label, tree }))).toEqual(
      real.map(({ label, tree }) => ({ label, tree })),
    );
  });
});

describe("stretch: same host calls as react-reconciler", () => {
  test.each(scenarios.map((s) => [s.name, s] as const))("%s", (_name, scenario) => {
    const real = runReal(scenario);
    const mini = runMini(scenario);
    expect(mini.map(({ label, calls }) => ({ label, calls }))).toEqual(
      real.map(({ label, calls }) => ({ label, calls })),
    );
  });
});
