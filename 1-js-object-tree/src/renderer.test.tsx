// What drill 1 should produce. These tests pin down an output shape, so they
// fail until you write src/renderer.ts. If you'd rather design your own shape,
// change the expected objects here first, then make the tests pass.
//
// The contract assumed here:
//   - `render(element, container)` is exported from ./renderer.
//   - It is synchronous: the container is filled in by the time it returns.
//   - Calling it again with the same container updates the existing tree.
//   - Elements are { type, props, children }, with `children` left out of props.
//   - Text is { text }.

import { render } from "./renderer";
import { KeyedList, StaticTree, TextTree, Toggle } from "./demo";

function newContainer() {
  return { children: [] as unknown[] };
}

test("mounts nested host elements", () => {
  const container = newContainer();
  render(<StaticTree />, container);

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

test("mounts text, including adjacent strings as separate text nodes", () => {
  const container = newContainer();
  render(<TextTree />, container);

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
        ],
      },
    ],
  });
});

test("re-rendering into the same container removes a child", () => {
  const container = newContainer();

  render(<Toggle show={true} />, container);
  const outerBox = (container.children as any[])[0];
  expect(outerBox.children).toEqual([
    { type: "box", props: { id: "maybe" }, children: [] },
  ]);

  render(<Toggle show={false} />, container);
  expect((container.children as any[])[0]).toBe(outerBox); // same object, updated in place
  expect(outerBox.children).toEqual([]);
});

// ---- Edge cases from the review. Each comment names the host config method(s) involved. ----

// Helper: the single top-level element in the container.
function top(container: { children: unknown[] }): any {
  return container.children[0];
}

describe("text", () => {
  // shouldSetTextContent: if it returns true, React creates no text instance,
  // so the element itself must keep the text.
  test.only("A: an element whose only child is a string keeps that text", () => {
    const container = newContainer();
    render(<box>hello</box>, container);

    expect(container).toEqual({
      children: [{ type: "box", props: {}, children: [{ text: "hello" }] }],
    });
  });

  // commitUpdate (or commitTextUpdate, depending on shouldSetTextContent).
  test("B: changing an element's only string child updates the text", () => {
    const container = newContainer();
    render(<leaf>one</leaf>, container);
    render(<leaf>two</leaf>, container);

    expect(top(container).children).toEqual([{ text: "two" }]);
  });

  // commitTextUpdate: an existing text instance gets new text, in place.
  test("C: changing one of several text children updates it in place", () => {
    const container = newContainer();
    render(<box>count: {1}</box>, container);
    const countText = top(container).children[1];

    render(<box>count: {2}</box>, container);
    expect(top(container).children).toEqual([{ text: "count: " }, { text: "2" }]);
    expect(top(container).children[1]).toBe(countText);
  });

  // createInstance + createTextInstance: a number child becomes exactly one text node.
  test("H: a number child becomes a single text node", () => {
    const container = newContainer();
    render(<leaf>{5}</leaf>, container);

    expect(top(container).children).toEqual([{ text: "5" }]);
  });

  // resetTextContent: only called if shouldSetTextContent ever returns true.
  test("G: replacing a string child with an element child", () => {
    const container = newContainer();
    render(<box>hi</box>, container);
    render(
      <box>
        <box id="z" />
      </box>,
      container,
    );

    expect(top(container).children).toEqual([
      { type: "box", props: { id: "z" }, children: [] },
    ]);
  });
});

describe("inserting and moving", () => {
  // insertBefore: a new child goes in front of an existing one.
  test("D: a new child is inserted before an existing sibling", () => {
    const container = newContainer();
    const Tree = ({ showA }: { showA: boolean }) => (
      <box>
        {showA && <box id="a" />}
        <box id="b" />
      </box>
    );
    render(<Tree showA={false} />, container);
    const b = top(container).children[0];

    render(<Tree showA={true} />, container);
    expect(top(container).children).toEqual([
      { type: "box", props: { id: "a" }, children: [] },
      { type: "box", props: { id: "b" }, children: [] },
    ]);
    expect(top(container).children[1]).toBe(b); // b was kept, not recreated
  });

  // appendChild / insertBefore with a child that is already in the parent: a move, not a copy.
  test("E: reordering a keyed list moves the same objects", () => {
    const container = newContainer();
    render(<KeyedList ids={["a", "b", "c"]} />, container);
    const [a, b, c] = top(container).children;

    render(<KeyedList ids={["c", "a", "b"]} />, container);
    expect(top(container).children).toEqual([
      { type: "item", props: { id: "c" }, children: [] },
      { type: "item", props: { id: "a" }, children: [] },
      { type: "item", props: { id: "b" }, children: [] },
    ]);
    const [first, second, third] = top(container).children;
    expect(first).toBe(c);
    expect(second).toBe(a);
    expect(third).toBe(b);
  });
});

// removeChildFromContainer. This one already passes; it guards against regressions.
test("F: rendering null empties the container", () => {
  const container = newContainer();
  render(<Toggle show={true} />, container);
  render(null, container);

  expect(container).toEqual({ children: [] });
});
