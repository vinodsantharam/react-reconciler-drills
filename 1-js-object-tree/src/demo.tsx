// Component trees to throw at your renderer, in the README's feature order.
// Render each one, read the instrumented log, and ask why the calls come in that order.

import { useState, useEffect } from "react";

// 1. Static mount: nested host elements, no state.
export function StaticTree() {
  return (
    <box id="root">
      <box id="a" />
      <box id="b" />
    </box>
  );
}

// 2. Text: text instances, and text mixed with elements.
export function TextTree() {
  return (
    <box>
      hello
      <leaf>world</leaf>
      {"two"} {"texts"}
    </box>
  );
}

// 3. Prop updates through state.
export function Counter({ onReady }: { onReady?: (inc: () => void) => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => onReady?.(() => setCount((c) => c + 1)), [onReady]);
  return <leaf count={count}>count: {count}</leaf>;
}

// 4. Removal: toggle a child in and out.
export function Toggle({ show }: { show: boolean }) {
  return <box>{show && <box id="maybe" />}</box>;
}

// 5. Keyed reordering: pass a different order of the same ids.
export function KeyedList({ ids }: { ids: string[] }) {
  return (
    <box>
      {ids.map((id) => (
        <item key={id} id={id} />
      ))}
    </box>
  );
}
