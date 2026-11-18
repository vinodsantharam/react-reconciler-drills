// Wraps a host config so every method call is logged before it runs.
// Pass your host config through this, hand the result to Reconciler(),
// then read the log to see what the reconciler asked for and in what order.

export type CallLog = { method: string; args: unknown[] }[];

export function instrument<T extends object>(
  hostConfig: T,
  log: CallLog = [],
  { print = true }: { print?: boolean } = {},
): T {
  return new Proxy(hostConfig, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const method = String(prop);
        log.push({ method, args });
        if (print) console.log(`${method}(${args.map(preview).join(", ")})`);
        return value.apply(target, args);
      };
    },
  });
}

// Keeps log lines short: functions and big objects are summarized.
function preview(arg: unknown): string {
  if (typeof arg === "function") return "fn";
  if (typeof arg === "string") return JSON.stringify(arg);
  if (arg === null || typeof arg !== "object") return String(arg);
  try {
    const json = JSON.stringify(arg);
    return json.length > 80 ? json.slice(0, 77) + "..." : json;
  } catch {
    return "[circular]";
  }
}
