import { instrument, type CallLog } from "./instrument";

test("logs method calls and forwards to the wrapped object", () => {
  const log: CallLog = [];
  const target = { add: (a: number, b: number) => a + b, flag: true };
  const wrapped = instrument(target, log, { print: false });

  expect(wrapped.add(2, 3)).toBe(5);
  expect(wrapped.flag).toBe(true);
  expect(log).toEqual([{ method: "add", args: [2, 3] }]);
});
