// Tests for the tooling, not for your code. These pass from the start.

import { createTestScheduler } from "./scheduler";

test("runs callbacks only when asked, oldest first", () => {
  const scheduler = createTestScheduler();
  const ran: string[] = [];
  scheduler.requestIdleCallback(() => ran.push("a"));
  scheduler.requestIdleCallback(() => ran.push("b"));

  expect(ran).toEqual([]);
  expect(scheduler.pending()).toBe(2);
  scheduler.runIdlePeriod();
  expect(ran).toEqual(["a"]);
  expect(scheduler.flushAll()).toBe(1);
  expect(ran).toEqual(["a", "b"]);
});

test("a deadline allows `budget` units, then asks to yield", () => {
  const scheduler = createTestScheduler();
  let units = 0;
  scheduler.requestIdleCallback((deadline) => {
    while (!deadline.shouldYield()) units++;
  });

  expect(scheduler.runIdlePeriod(3)).toBe(3);
  expect(units).toBe(3);
});

test("work that yields and re-requests is resumed by flushAll", () => {
  const scheduler = createTestScheduler();
  let remaining = 10;
  const work = (deadline: { shouldYield(): boolean }) => {
    while (remaining > 0 && !deadline.shouldYield()) remaining--;
    if (remaining > 0) scheduler.requestIdleCallback(work);
  };
  scheduler.requestIdleCallback(work);

  expect(scheduler.flushAll(3)).toBe(4);
  expect(remaining).toBe(0);
});

test("flushAll stops a reconciler that never stops asking", () => {
  const scheduler = createTestScheduler({ maxPeriods: 5 });
  const forever = () => scheduler.requestIdleCallback(forever);
  scheduler.requestIdleCallback(forever);

  expect(() => scheduler.flushAll()).toThrow(/Still busy/);
});
