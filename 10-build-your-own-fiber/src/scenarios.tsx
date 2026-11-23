// Scenarios run on BOTH reconcilers by compare.test.tsx and `npm run compare`.
// Each step either renders a new element into the root or changes state from outside.
// `h` and `d` are passed in, so the same JSX builds your elements or React's.

import type { Demos } from "./demo";
import type { HostNode } from "./host-config";
import type { CallLog } from "./instrument";

type Scope = { h: (...args: any[]) => any; d: Demos };
export type Step =
  | { label: string; render: (scope: Scope) => unknown }
  | { label: string; act: (d: Demos) => void };
export type Scenario = { name: string; steps: Step[] };

export const scenarios: Scenario[] = [
  {
    name: "mount a static tree",
    steps: [{ label: "mount", render: ({ h, d }) => <d.StaticTree /> }],
  },
  {
    name: "mount text",
    steps: [{ label: "mount", render: ({ h, d }) => <d.TextTree /> }],
  },
  {
    name: "function components",
    steps: [{ label: "mount", render: ({ h, d }) => <d.Nested /> }],
  },
  {
    name: "holes",
    steps: [{ label: "mount", render: ({ h, d }) => <d.Holes /> }],
  },
  {
    name: "toggle a child in the middle",
    steps: [
      { label: "hidden", render: ({ h, d }) => <d.Toggle show={false} /> },
      { label: "show", render: ({ h, d }) => <d.Toggle show={true} /> },
      { label: "hide", render: ({ h, d }) => <d.Toggle show={false} /> },
    ],
  },
  {
    name: "swap the type in place",
    steps: [
      { label: "box", render: ({ h, d }) => <d.Swap kind="box" /> },
      { label: "leaf", render: ({ h, d }) => <d.Swap kind="leaf" /> },
    ],
  },
  {
    name: "replace the root component",
    steps: [
      { label: "StaticTree", render: ({ h, d }) => <d.StaticTree /> },
      { label: "Nested", render: ({ h, d }) => <d.Nested /> },
      { label: "null", render: () => null },
    ],
  },
  {
    name: "keyed list",
    steps: [
      { label: "a b c", render: ({ h, d }) => <d.KeyedList ids={["a", "b", "c"]} /> },
      { label: "c a b", render: ({ h, d }) => <d.KeyedList ids={["c", "a", "b"]} /> },
      { label: "b c a", render: ({ h, d }) => <d.KeyedList ids={["b", "c", "a"]} /> },
      { label: "b d a", render: ({ h, d }) => <d.KeyedList ids={["b", "d", "a"]} /> },
      { label: "a d b e", render: ({ h, d }) => <d.KeyedList ids={["a", "d", "b", "e"]} /> },
    ],
  },
  {
    name: "index-keyed list",
    steps: [
      { label: "a b c", render: ({ h, d }) => <d.IndexList ids={["a", "b", "c"]} /> },
      { label: "c a b", render: ({ h, d }) => <d.IndexList ids={["c", "a", "b"]} /> },
      { label: "c a", render: ({ h, d }) => <d.IndexList ids={["c", "a"]} /> },
    ],
  },
  {
    name: "counters",
    steps: [
      { label: "mount a b", render: ({ h, d }) => <d.Counters labels={["a", "b"]} /> },
      { label: "inc a twice", act: (d) => (d.handles.inc("a"), d.handles.inc("a")) },
      { label: "set b to 5", act: (d) => d.handles.set("b", 5) },
      { label: "reorder b a", render: ({ h, d }) => <d.Counters labels={["b", "a"]} /> },
    ],
  },
  {
    name: "two hooks",
    steps: [
      { label: "mount", render: ({ h, d }) => <d.TwoStates /> },
      { label: "set B", act: (d) => d.handles.set("B", "b1") },
    ],
  },
  {
    name: "stateful child under a changing parent",
    steps: [
      { label: "mount", render: ({ h, d }) => <d.Frame title="one" show={true} /> },
      { label: "inc", act: (d) => d.handles.inc("framed") },
      { label: "retitle", render: ({ h, d }) => <d.Frame title="two" show={true} /> },
      { label: "hide", render: ({ h, d }) => <d.Frame title="two" show={false} /> },
      { label: "show", render: ({ h, d }) => <d.Frame title="two" show={true} /> },
    ],
  },
];

// The host calls worth comparing. Left out: host context and shouldSetTextContent
// (React calls them in places that are an implementation detail) and clearContainer
// (React calls it before the first mount).
export const COMPARED = [
  "createInstance",
  "createTextInstance",
  "appendInitialChild",
  "finalizeInitialChildren",
  "prepareForCommit",
  "appendChildToContainer",
  "insertInContainerBefore",
  "removeChildFromContainer",
  "appendChild",
  "insertBefore",
  "removeChild",
  "commitUpdate",
  "commitTextUpdate",
  "resetAfterCommit",
];

// One readable line per call: the method and the host nodes it touched.
export function describeCalls(log: CallLog): string[] {
  return log
    .filter((call) => COMPARED.includes(call.method))
    .map(({ method, args }) => {
      switch (method) {
        case "createInstance":
          return `${method} ${args[0]}${idOf(args[1])}`;
        case "createTextInstance":
          return `${method} ${JSON.stringify(args[0])}`;
        case "commitTextUpdate":
          return `${method} ${JSON.stringify(args[1])} → ${JSON.stringify(args[2])}`;
        case "prepareForCommit":
        case "resetAfterCommit":
          return method;
        case "appendChildToContainer":
        case "insertInContainerBefore":
        case "removeChildFromContainer":
          return `${method} ${args
            .slice(1, method === "insertInContainerBefore" ? 3 : 2)
            .map(nodeName)
            .join(" ")}`;
        default:
          // Only the host nodes: (parent, child) or (parent, child, beforeChild), or the
          // instance for commitUpdate / finalizeInitialChildren.
          return `${method} ${args.slice(0, ARITY[method] ?? 1).map(nodeName).join(" ")}`;
      }
    });
}

const ARITY: Record<string, number> = {
  appendInitialChild: 2,
  appendChild: 2,
  removeChild: 2,
  insertBefore: 3,
};

function idOf(props: unknown) {
  const id = (props as { id?: unknown })?.id;
  return id === undefined ? "" : `#${id}`;
}

function nodeName(node: unknown) {
  const n = node as HostNode;
  if (n && "text" in n) return JSON.stringify(n.text);
  if (n && "type" in n) return `${n.type}${idOf(n.props)}`;
  return String(node);
}
