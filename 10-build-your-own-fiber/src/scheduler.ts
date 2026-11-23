// A fake "idle time" scheduler, so interruptible rendering can be tested without
// real time. It plays the role of the browser's requestIdleCallback (what Build your
// own React uses) or React's own `scheduler` package.
//
// The contract your reconciler follows:
//   - Ask for time with `requestIdleCallback(callback)` only when there is work to
//     do. Don't re-request forever: `flushAll()` treats that as an infinite loop.
//   - Inside the callback, call `deadline.shouldYield()` BEFORE each unit of work.
//     When it returns true, stop, and request another callback for the rest.
//
// What a "unit of work" is, is up to you. In React it's one fiber
// (`performUnitOfWork`). The commit is not a unit: once the render phase is done,
// commit everything in one go.

export type Deadline = { shouldYield(): boolean };
export type IdleCallback = (deadline: Deadline) => void;

export interface Scheduler {
  requestIdleCallback(callback: IdleCallback): void;
}

export interface TestScheduler extends Scheduler {
  // Number of callbacks waiting to run.
  pending(): number;
  // Runs ONE waiting callback (the oldest). Its deadline answers `false` to
  // shouldYield() `budget` times, then `true` forever. Returns how many units it used.
  runIdlePeriod(budget?: number): number;
  // Runs idle periods until nothing is waiting. Returns how many periods it took.
  flushAll(budget?: number): number;
}

export function createTestScheduler({ maxPeriods = 10_000 } = {}): TestScheduler {
  const queue: IdleCallback[] = [];

  function runIdlePeriod(budget = Infinity): number {
    const callback = queue.shift();
    if (!callback) return 0;
    let used = 0;
    callback({
      shouldYield() {
        if (used >= budget) return true;
        used++;
        return false;
      },
    });
    return used;
  }

  return {
    requestIdleCallback(callback) {
      queue.push(callback);
    },
    pending: () => queue.length,
    runIdlePeriod,
    flushAll(budget = Infinity) {
      let periods = 0;
      while (queue.length > 0) {
        if (++periods > maxPeriods) {
          throw new Error(
            `Still busy after ${maxPeriods} idle periods: is the reconciler requesting callbacks when there's no work left?`,
          );
        }
        runIdlePeriod(budget);
      }
      return periods;
    },
  };
}
