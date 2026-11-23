// What drill 10 should do. These tests watch your reconciler from the host's side:
// the container's tree, and the host calls it made. They fail until you write
// src/element.ts and src/reconciler.ts. They don't look at your fibers: their shape
// is yours to design.
//
// The contract assumed here:
//   - `createElement` (element.ts) is the JSX factory. `useState` comes from reconciler.ts.
//   - `createReconciler(host, scheduler)` returns { createContainer, updateContainer },
//     shaped like react-reconciler's.
//   - `updateContainer(element, root)` only SCHEDULES work. All work runs inside the
//     scheduler's idle callbacks (see scheduler.ts for the rules). `setState` too.
//   - Calling updateContainer again on the same root updates the existing tree.
//   - The host is your drill 1 host (host-config.ts): elements are
//     { type, props, children } without `children` in props, text is { text }.
//
// Steps follow the order suggested in reconciler.ts. Each step's tests can pass
// without the later steps. For the call-by-call comparison with react-reconciler,
// see compare.test.tsx.

import { createElement as h, type MiniNode } from "./element";
import { createReconciler, useState } from "./reconciler";
import { makeDemos } from "./demo";
import { createTestScheduler } from "./scheduler";
import { instrument, type CallLog } from "./instrument";
import {
  objectTreeHost,
  type Container,
  type HostConfig,
  type HostNode,
  type Instance,
} from "./host-config";

function setup(host: HostConfig = objectTreeHost) {
  const container: Container = { children: [] };
  const log: CallLog = [];
  const scheduler = createTestScheduler();
  const reconciler = createReconciler(instrument(host, log, { print: false }), scheduler);
  const root = reconciler.createContainer(container);
  const demos = makeDemos({ h, useState });

  return {
    container,
    log,
    scheduler,
    demos,
    // Schedules an update without running it.
    schedule(element: MiniNode) {
      reconciler.updateContainer(element, root);
    },
    // Schedules an update and runs all the work, like drill 1's synchronous render().
    render(element: MiniNode) {
      reconciler.updateContainer(element, root);
      scheduler.flushAll();
    },
    // Runs `fn` (state changes from outside, like an event handler), then all the work.
    act(fn: () => void) {
      fn();
      scheduler.flushAll();
    },
    // Names of the host methods called since the last clearLog(), in order.
    methods(...only: string[]) {
      return log.map((c) => c.method).filter((m) => only.length === 0 || only.includes(m));
    },
    calls(method: string) {
      return log.filter((c) => c.method === method);
    },
    clearLog() {
      log.length = 0;
    },
  };
}

const MUTATIONS = [
  "clearContainer",
  "appendChildToContainer",
  "insertInContainerBefore",
  "removeChildFromContainer",
  "appendChild",
  "insertBefore",
  "removeChild",
  "commitUpdate",
  "commitTextUpdate",
];

function element(node: HostNode | undefined): Instance {
  if (!node || !("type" in node)) throw new Error(`Not an element: ${JSON.stringify(node)}`);
  return node;
}

// The <item> instances of a KeyedList / IndexList, by id.
function itemsOf(container: Container) {
  return element(container.children[0]).children.map(element);
}

function ids(container: Container) {
  return itemsOf(container).map((item) => item.props.id);
}

const counterTree = (...counters: [string, number][]) => ({
  children: [
    {
      type: "box",
      props: {},
      children: counters.map(([label, count]) => ({
        type: "leaf",
        props: { count },
        children: [{ text: label }, { text: ": " }, { text: String(count) }],
      })),
    },
  ],
});

describe("2. mount", () => {
  test("nothing happens until the scheduler runs", () => {
    const { container, scheduler, schedule, render, demos, methods } = setup();
    schedule(<demos.StaticTree />);

    expect(container.children).toEqual([]);
    expect(methods("createInstance", "createTextInstance")).toEqual([]);
    expect(scheduler.pending()).toBeGreaterThan(0);

    scheduler.flushAll();
    expect(container.children).toHaveLength(1);
  });

  test("mounts nested host elements", () => {
    const { container, render, demos } = setup();
    render(<demos.StaticTree />);

    expect(container).toEqual({
      children: [
        {
          type: "box",
          props: { id: "root" },
          children: [
            { type: "box", props: { id: "a" }, children: [] },
            { type: "box", props: { id: "b" }, children: [] },
          ],
        },
      ],
    });
  });

  test("mounts text: strings and numbers, adjacent strings as separate nodes", () => {
    const { container, render, demos } = setup();
    render(<demos.TextTree />);

    expect(container).toEqual({
      children: [
        {
          type: "box",
          props: {},
          children: [
            { text: "hello" },
            { type: "leaf", props: {}, children: [{ text: "world" }] },
            { text: "two" },
            { text: " " },
            { text: "texts" },
            { text: "42" },
          ],
        },
      ],
    });
  });

  test("a host element can be rendered directly into the root", () => {
    const { container, render } = setup();
    render(<leaf count={1}>direct</leaf>);

    expect(container).toEqual({
      children: [{ type: "leaf", props: { count: 1 }, children: [{ text: "direct" }] }],
    });
  });

  test("function components leave no trace in the host tree", () => {
    const { container, render, demos, calls } = setup();
    render(<demos.Nested />);

    expect(container).toEqual({
      children: [
        {
          type: "box",
          props: { id: "panel" },
          children: [
            { type: "leaf", props: {}, children: [{ text: "one" }] },
            { type: "leaf", props: {}, children: [{ text: "two" }] },
          ],
        },
      ],
    });
    // Only host types reach createInstance.
    expect(calls("createInstance").map((c) => c.args[0])).toEqual(["leaf", "leaf", "box"]);
  });

  test("null, undefined, booleans and empty components render nothing", () => {
    const { container, render, demos } = setup();
    render(<demos.Holes />);

    expect(container).toEqual({
      children: [
        {
          type: "box",
          props: {},
          children: [{ type: "leaf", props: {}, children: [{ text: "kept" }] }],
        },
      ],
    });
  });

  test("rendering null into the root renders nothing", () => {
    const { container, render } = setup();
    render(null);

    expect(container.children).toEqual([]);
  });
});

describe("2. mount: how the host is driven", () => {
  test("creates children before their parent (completeWork goes bottom-up)", () => {
    const { render, demos, calls } = setup();
    render(<demos.StaticTree />);

    expect(calls("createInstance").map((c) => (c.args[1] as any).id)).toEqual([
      "a",
      "b",
      "root",
    ]);
  });

  test("builds the tree off-screen, then attaches it to the container in ONE call", () => {
    const { render, demos, methods } = setup();
    render(<demos.Nested />);

    // "one" into leaf, "two" into leaf, both leaves into the box.
    expect(methods("appendInitialChild")).toHaveLength(4);
    expect(methods(...MUTATIONS).filter((m) => m !== "clearContainer")).toEqual([
      "appendChildToContainer",
    ]);
  });

  test("calls finalizeInitialChildren once an instance has its children", () => {
    const { render, demos, methods } = setup();
    render(<demos.StaticTree />);

    expect(
      methods("createInstance", "appendInitialChild", "finalizeInitialChildren"),
    ).toEqual([
      "createInstance", // a
      "finalizeInitialChildren",
      "createInstance", // b
      "finalizeInitialChildren",
      "createInstance", // root
      "appendInitialChild",
      "appendInitialChild",
      "finalizeInitialChildren",
    ]);
  });

  test("passes host context down the tree", () => {
    // A host whose context is the path of host types above the current spot.
    const host: HostConfig = {
      ...objectTreeHost,
      getRootHostContext: () => "root",
      getChildHostContext: (parent, type) => `${parent}>${type}`,
    };
    const { render, demos, calls } = setup(host);
    render(<demos.Nested />);

    const contexts = calls("createInstance").map((c) => [c.args[0], c.args[3]]);
    expect(contexts).toEqual([
      ["leaf", "root>box"],
      ["leaf", "root>box"],
      ["box", "root"],
    ]);
    const textContexts = calls("createTextInstance").map((c) => [c.args[0], c.args[2]]);
    expect(textContexts).toEqual([
      ["one", "root>box>leaf"],
      ["two", "root>box>leaf"],
    ]);
  });

  test("gives the host your fiber as the last argument", () => {
    const { render, demos, calls } = setup();
    render(<demos.Nested />);

    for (const call of [...calls("createInstance"), ...calls("createTextInstance")]) {
      expect(call.args[call.method === "createInstance" ? 4 : 3]).toBeTypeOf("object");
    }
  });
});

describe("2. commit", () => {
  test("every change happens between prepareForCommit and resetAfterCommit", () => {
    const { render, demos, log } = setup();
    render(<demos.Toggle show={false} />);
    render(<demos.Toggle show={true} />);
    render(<demos.Toggle show={false} />);

    let inCommit = false;
    let commits = 0;
    for (const { method } of log) {
      if (method === "prepareForCommit") {
        expect(inCommit).toBe(false);
        inCommit = true;
        commits++;
      } else if (method === "resetAfterCommit") {
        expect(inCommit).toBe(true);
        inCommit = false;
      } else if (MUTATIONS.includes(method)) {
        expect({ method, inCommit }).toEqual({ method, inCommit: true });
      }
    }
    expect(inCommit).toBe(false);
    expect(commits).toBe(3);
  });
});

describe("3. interruptible rendering", () => {
  const many = Array.from({ length: 50 }, (_, i) => `id${i}`);

  test("yields to the scheduler between units of work", () => {
    const { container, scheduler, schedule, demos } = setup();
    schedule(<demos.KeyedList ids={many} />);

    // One unit per idle period: at least one period per fiber.
    const periods = scheduler.flushAll(1);
    expect(periods).toBeGreaterThan(50);
    expect(ids(container)).toEqual(many);
  });

  test("never shows a half-built tree", () => {
    const { container, scheduler, schedule, demos } = setup();
    schedule(<demos.KeyedList ids={many} />);

    while (scheduler.pending() > 0) {
      scheduler.runIdlePeriod(1);
      expect([0, 1]).toContain(container.children.length);
      if (container.children.length === 1) expect(ids(container)).toEqual(many);
    }
    expect(ids(container)).toEqual(many);
  });

  test("never shows a half-done update", () => {
    const { container, scheduler, render, schedule, demos } = setup();
    const reversed = [...many].reverse();
    render(<demos.KeyedList ids={many} />);
    schedule(<demos.KeyedList ids={reversed} />);

    while (scheduler.pending() > 0) {
      scheduler.runIdlePeriod(1);
      expect([many, reversed]).toContainEqual(ids(container));
    }
    expect(ids(container)).toEqual(reversed);
  });

  test("an update arriving half-way through a render wins", () => {
    const { container, scheduler, schedule, demos } = setup();
    schedule(<demos.KeyedList ids={many} />);
    scheduler.runIdlePeriod(5);
    schedule(<demos.KeyedList ids={["x", "y"]} />);
    scheduler.flushAll(5);

    expect(ids(container)).toEqual(["x", "y"]);
  });
});

describe("4. updates", () => {
  test("keeps host instances across renders, and updates their props", () => {
    const { container, render, demos, calls, clearLog } = setup();
    render(<demos.Frame title="one" show={false} />);
    const box = container.children[0];
    clearLog();

    render(<demos.Frame title="two" show={false} />);
    expect(container.children[0]).toBe(box);
    expect(element(box).props).toEqual({ id: "two" });
    expect(calls("createInstance")).toEqual([]);
    expect(calls("commitUpdate").map((c) => c.args[0])).toEqual([box]);
    expect(calls("commitUpdate")[0].args[3]).toMatchObject({ id: "two" });
  });

  test("keeps text instances, and updates their text", () => {
    const { container, render, calls, clearLog } = setup();
    render(<leaf>{"before"}</leaf>);
    const text = element(container.children[0]).children[0];
    clearLog();

    render(<leaf>{"after"}</leaf>);
    expect(element(container.children[0]).children[0]).toBe(text);
    expect(text).toEqual({ text: "after" });
    expect(calls("createTextInstance")).toEqual([]);
    expect(calls("commitTextUpdate").map((c) => c.args.slice(1))).toEqual([
      ["before", "after"],
    ]);
  });

  test("removes a child", () => {
    const { container, render, demos, methods, clearLog } = setup();
    render(<demos.Toggle show={true} />);
    const [first, , last] = element(container.children[0]).children;
    clearLog();

    render(<demos.Toggle show={false} />);
    expect(element(container.children[0]).children).toEqual([
      { type: "leaf", props: {}, children: [{ text: "first" }] },
      { type: "leaf", props: {}, children: [{ text: "last" }] },
    ]);
    expect(element(container.children[0]).children[0]).toBe(first);
    expect(element(container.children[0]).children[1]).toBe(last);
    expect(methods("removeChild")).toHaveLength(1);
  });

  test("inserts a new child in the right place, not at the end", () => {
    const { container, render, demos } = setup();
    render(<demos.Toggle show={false} />);
    const [first, last] = element(container.children[0]).children;

    render(<demos.Toggle show={true} />);
    expect(element(container.children[0]).children).toEqual([
      { type: "leaf", props: {}, children: [{ text: "first" }] },
      { type: "box", props: { id: "maybe" }, children: [] },
      { type: "leaf", props: {}, children: [{ text: "last" }] },
    ]);
    expect(element(container.children[0]).children[0]).toBe(first);
    expect(element(container.children[0]).children[2]).toBe(last);
  });

  test("a different type in the same place is replaced, not updated", () => {
    const { container, render, demos, calls, clearLog } = setup();
    render(<demos.Swap kind="box" />);
    const old = element(container.children[0]).children[0];
    clearLog();

    render(<demos.Swap kind="leaf" />);
    expect(element(container.children[0]).children).toEqual([
      { type: "leaf", props: {}, children: [{ text: "x" }] },
    ]);
    expect(calls("removeChild").map((c) => c.args[1])).toEqual([old]);
  });

  test("a different component at the root replaces the whole tree", () => {
    const { container, render, demos } = setup();
    render(<demos.StaticTree />);
    const old = container.children[0];

    render(<demos.Nested />);
    expect(container.children).toHaveLength(1);
    expect(container.children[0]).not.toBe(old);
    expect(element(container.children[0]).props).toEqual({ id: "panel" });
  });

  test("rendering null removes everything", () => {
    const { container, render, demos, methods, clearLog } = setup();
    render(<demos.Nested />);
    clearLog();

    render(null);
    expect(container.children).toEqual([]);
    // Only the top host node is removed: its children go with it.
    expect(methods("removeChildFromContainer", "removeChild")).toEqual([
      "removeChildFromContainer",
    ]);
  });
});

describe("5. keys", () => {
  test("a keyed reorder moves the same instances", () => {
    const { container, render, demos, methods, clearLog } = setup();
    render(<demos.KeyedList ids={["a", "b", "c"]} />);
    const [a, b, c] = itemsOf(container);
    clearLog();

    render(<demos.KeyedList ids={["c", "a", "b"]} />);
    expect(itemsOf(container)).toEqual([c, a, b]);
    expect(itemsOf(container)[0]).toBe(c);
    expect(itemsOf(container)[1]).toBe(a);
    expect(itemsOf(container)[2]).toBe(b);
    expect(methods("createInstance", "removeChild")).toEqual([]);
  });

  test("a keyed reversal keeps every instance", () => {
    const { container, render, demos } = setup();
    render(<demos.KeyedList ids={["a", "b", "c", "d"]} />);
    const before = itemsOf(container);

    render(<demos.KeyedList ids={["d", "c", "b", "a"]} />);
    expect(itemsOf(container)).toEqual([...before].reverse());
    itemsOf(container).forEach((item, i) => expect(item).toBe(before[3 - i]));
  });

  test("keyed removal and insertion in the middle", () => {
    const { container, render, demos, calls, clearLog } = setup();
    render(<demos.KeyedList ids={["a", "b", "c"]} />);
    const [a, b, c] = itemsOf(container);
    clearLog();

    render(<demos.KeyedList ids={["a", "d", "c"]} />);
    expect(ids(container)).toEqual(["a", "d", "c"]);
    expect(itemsOf(container)[0]).toBe(a);
    expect(itemsOf(container)[2]).toBe(c);
    expect(calls("removeChild").map((call) => call.args[1])).toEqual([b]);
    expect(calls("createInstance").map((call) => (call.args[1] as any).id)).toEqual(["d"]);
  });

  test("without real keys, instances stay in place and get new props", () => {
    const { container, render, demos, methods, calls, clearLog } = setup();
    render(<demos.IndexList ids={["a", "b", "c"]} />);
    const before = itemsOf(container);
    clearLog();

    render(<demos.IndexList ids={["c", "a", "b"]} />);
    expect(ids(container)).toEqual(["c", "a", "b"]);
    itemsOf(container).forEach((item, i) => expect(item).toBe(before[i]));
    expect(methods("appendChild", "insertBefore", "removeChild")).toEqual([]);
    const updated = calls("commitUpdate").map((c) => c.args[0] as Instance);
    expect(updated.filter((instance) => instance.type === "item")).toEqual(before);
  });
});

describe("6. useState", () => {
  test("renders the initial state", () => {
    const { container, render, demos } = setup();
    render(<demos.Counters labels={["a"]} />);

    expect(container).toEqual(counterTree(["a", 0]));
  });

  test("setState schedules a render; it doesn't render right away", () => {
    const { container, scheduler, render, demos } = setup();
    render(<demos.Counters labels={["a"]} />);

    demos.handles.inc("a");
    expect(container).toEqual(counterTree(["a", 0]));
    expect(scheduler.pending()).toBeGreaterThan(0);

    scheduler.flushAll();
    expect(container).toEqual(counterTree(["a", 1]));
  });

  test("updates made before the work runs are batched into one commit", () => {
    const { container, render, act, demos, methods, clearLog } = setup();
    render(<demos.Counters labels={["a"]} />);
    clearLog();

    act(() => {
      demos.handles.inc("a");
      demos.handles.inc("a");
      demos.handles.inc("a");
    });
    expect(container).toEqual(counterTree(["a", 3]));
    expect(methods("prepareForCommit")).toHaveLength(1);
  });

  test("accepts a value or an updater function", () => {
    const { container, render, act, demos } = setup();
    render(<demos.Counters labels={["a"]} />);

    act(() => {
      demos.handles.set("a", 5);
      demos.handles.inc("a");
    });
    expect(container).toEqual(counterTree(["a", 6]));
  });

  test("keeps the host instances when state changes", () => {
    const { container, render, act, demos, methods, clearLog } = setup();
    render(<demos.Counters labels={["a"]} />);
    const leaf = element(container.children[0]).children[0];
    clearLog();

    act(() => demos.handles.inc("a"));
    expect(element(container.children[0]).children[0]).toBe(leaf);
    expect(methods("createInstance", "createTextInstance")).toEqual([]);
  });

  test("each component instance has its own state", () => {
    const { container, render, act, demos } = setup();
    render(<demos.Counters labels={["a", "b"]} />);

    act(() => demos.handles.inc("b"));
    expect(container).toEqual(counterTree(["a", 0], ["b", 1]));
  });

  test("hooks in one component keep their order", () => {
    const { container, render, act, demos } = setup();
    render(<demos.TwoStates />);

    act(() => {
      demos.handles.set("B", "b1");
      demos.handles.set("A", "a1");
    });
    const leaves = element(container.children[0]).children.map(element);
    expect(leaves.map((leaf) => leaf.children)).toEqual([[{ text: "a1" }], [{ text: "b1" }]]);
  });

  test("state survives a re-render from above", () => {
    const { container, render, act, demos } = setup();
    render(<demos.Frame title="one" show={true} />);
    act(() => demos.handles.inc("framed"));

    render(<demos.Frame title="two" show={true} />);
    expect(element(container.children[0]).props).toEqual({ id: "two" });
    expect(element(element(container.children[0]).children[0]).props).toEqual({ count: 1 });
  });

  test("state is lost when the component unmounts", () => {
    const { container, render, act, demos } = setup();
    render(<demos.Frame title="one" show={true} />);
    act(() => demos.handles.inc("framed"));

    render(<demos.Frame title="one" show={false} />);
    render(<demos.Frame title="one" show={true} />);
    expect(element(element(container.children[0]).children[0]).props).toEqual({ count: 0 });
  });

  test("state follows its key when components are reordered", () => {
    const { container, render, act, demos } = setup();
    render(<demos.Counters labels={["a", "b"]} />);
    act(() => demos.handles.inc("a"));

    render(<demos.Counters labels={["b", "a"]} />);
    expect(container).toEqual(counterTree(["b", 0], ["a", 1]));
  });

  test("a state update during an unfinished render doesn't lose either update", () => {
    const { container, scheduler, render, schedule, demos } = setup();
    render(<demos.Counters labels={["a"]} />);

    schedule(<demos.Counters labels={["a", "b"]} />);
    scheduler.runIdlePeriod(2);
    demos.handles.inc("a");
    scheduler.flushAll(2);

    expect(container).toEqual(counterTree(["a", 1], ["b", 0]));
  });
});
