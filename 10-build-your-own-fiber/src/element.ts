// Step 1: elements. What JSX turns into.
//
// With the classic JSX transform (see tsconfig.json), the compiler rewrites
//   <box id="a">hi{name}</box>
// into
//   h("box", { id: "a" }, "hi", name)
// Every .tsx file that uses your reconciler imports `createElement as h` from here.
//
// You decide what an element looks like. Things to decide:
//   - Where `children` go, and what a string or number child turns into.
//   - What happens to `null`, `undefined`, `true`, `false` and nested arrays
//     (`{show && <box />}`, `{ids.map(...)}`).
//   - Where `key` goes. React takes it out of props: a component never sees it.
// Compare with React's own: console.log(React.createElement("box", { key: "k", id: 1 }, "hi")).

export type Props = Record<string, unknown>;

// A function component.
export type Component<P = any> = (props: P) => MiniNode;

// Yours to design. `unknown` until you do.
export type MiniElement = unknown;

// Anything that can appear as a child, or be returned by a component.
export type MiniNode = MiniElement | string | number | boolean | null | undefined | MiniNode[];

export function createElement(
  type: string | Component,
  props: Props | null,
  ...children: MiniNode[]
): MiniElement {
  throw new Error("createElement: not implemented");
}
