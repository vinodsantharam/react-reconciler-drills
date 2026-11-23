// Component trees to throw at your reconciler, in the suggested step order.
//
// They're built by a factory, so the SAME components run on your reconciler and on
// the real one: pass your createElement and useState, or React's.
//   const demos = makeDemos({ h: createElement, useState });        // yours
//   const demos = makeDemos({ h: React.createElement, useState: React.useState }); // real
//
// `handles` lets a test change state from outside, the way an event handler would:
//   demos.handles.inc("a")  // calls setCount on the Counter labelled "a"

type Factory = { h: (...args: any[]) => any; useState: <S>(initial: S) => [S, (a: any) => void] };

export function makeDemos({ h, useState }: Factory) {
  const setters = new Map<string, (action: any) => void>();
  const handles = {
    inc(label: string) {
      const set = setters.get(label);
      if (!set) throw new Error(`No Counter "${label}" has rendered`);
      set((c: number) => c + 1);
    },
    set(label: string, value: unknown) {
      const set = setters.get(label);
      if (!set) throw new Error(`No Counter "${label}" has rendered`);
      set(value);
    },
  };

  // ---- 2. Mount ----

  function StaticTree() {
    return (
      <box id="root">
        <box id="a" />
        <box id="b" />
      </box>
    );
  }

  // Strings, numbers, and adjacent strings (separate text nodes, like React).
  function TextTree() {
    return (
      <box>
        hello
        <leaf>world</leaf>
        {"two"} {"texts"}
        {42}
      </box>
    );
  }

  // Function components have no host instance. Only their output reaches the host.
  function Label({ text }: { text: string }) {
    return <leaf>{text}</leaf>;
  }
  function Panel({ children }: { children?: unknown }) {
    return <box id="panel">{children}</box>;
  }
  function Nested() {
    return (
      <Panel>
        <Label text="one" />
        <Label text="two" />
      </Panel>
    );
  }

  // Holes: null, undefined, booleans, and a component that renders nothing.
  function Nothing() {
    return null;
  }
  function Holes() {
    return (
      <box>
        {null}
        {undefined}
        {false}
        {true}
        <Nothing />
        <leaf>kept</leaf>
      </box>
    );
  }

  // ---- 4. Updates ----

  // A child appearing and disappearing BETWEEN two siblings: it must go back in the
  // right place, not at the end.
  function Toggle({ show }: { show: boolean }) {
    return (
      <box>
        <leaf>first</leaf>
        {show && <box id="maybe" />}
        <leaf>last</leaf>
      </box>
    );
  }

  // Same position, different type: replaced, not updated.
  function Swap({ kind }: { kind: "box" | "leaf" }) {
    return <box>{kind === "box" ? <box id="x" /> : <leaf>x</leaf>}</box>;
  }

  // ---- 5. Keys ----

  function KeyedList({ ids }: { ids: string[] }) {
    return (
      <box>
        {ids.map((id) => (
          <item key={id} id={id} />
        ))}
      </box>
    );
  }

  // Index keys: the same as no keys, but without React's warning.
  function IndexList({ ids }: { ids: string[] }) {
    return (
      <box>
        {ids.map((id, index) => (
          <item key={index} id={id} />
        ))}
      </box>
    );
  }

  // ---- 6. useState ----

  function Counter({ label }: { label: string }) {
    const [count, setCount] = useState(0);
    setters.set(label, setCount);
    return (
      <leaf count={count}>
        {label}: {count}
      </leaf>
    );
  }

  function Counters({ labels }: { labels: string[] }) {
    return (
      <box>
        {labels.map((label) => (
          <Counter key={label} label={label} />
        ))}
      </box>
    );
  }

  // Two hooks in one component: they must not get mixed up.
  function TwoStates() {
    const [a, setA] = useState("a0");
    const [b, setB] = useState("b0");
    setters.set("A", setA);
    setters.set("B", setB);
    return (
      <box>
        <leaf>{a}</leaf>
        <leaf>{b}</leaf>
      </box>
    );
  }

  // Changes from a parent, under a stateful child.
  function Frame({ title, show }: { title: string; show: boolean }) {
    return (
      <box id={title}>
        {show && <Counter label="framed" />}
      </box>
    );
  }

  return {
    handles,
    StaticTree,
    TextTree,
    Nested,
    Holes,
    Toggle,
    Swap,
    KeyedList,
    IndexList,
    Counter,
    Counters,
    TwoStates,
    Frame,
  };
}

export type Demos = ReturnType<typeof makeDemos>;
