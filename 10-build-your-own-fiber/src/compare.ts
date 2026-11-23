// `npm run compare [part of a scenario name]`
// Prints the real reconciler's host calls next to yours, step by step.
// Lines that differ are marked with ✗.

import { runMini, runReal, type StepResult } from "./run";
import { scenarios } from "./scenarios";

declare const process: { argv: string[] };
const filter = process.argv[2]?.toLowerCase();
const WIDTH = 52;

for (const scenario of scenarios) {
  if (filter && !scenario.name.toLowerCase().includes(filter)) continue;
  console.log(`\n=== ${scenario.name} ===`);

  const real = runReal(scenario);
  let mini: StepResult[];
  try {
    mini = runMini(scenario);
  } catch (error) {
    console.log(`  your reconciler threw: ${(error as Error).message}`);
    continue;
  }

  real.forEach((step, i) => {
    const mine = mini[i]?.calls ?? [];
    const sameTree = JSON.stringify(step.tree) === JSON.stringify(mini[i]?.tree);
    console.log(`\n--- ${step.label} ${sameTree ? "(same tree)" : "✗ DIFFERENT TREE"}`);
    console.log(`  ${"react-reconciler".padEnd(WIDTH)}  yours`);
    for (let line = 0; line < Math.max(step.calls.length, mine.length); line++) {
      const left = step.calls[line] ?? "";
      const right = mine[line] ?? "";
      const mark = left === right ? " " : "✗";
      console.log(`${mark} ${left.padEnd(WIDTH)}  ${right}`);
    }
  });
}
