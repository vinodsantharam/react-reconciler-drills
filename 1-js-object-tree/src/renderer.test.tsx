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
import { StaticTree, TextTree, Toggle } from "./demo";

function newContainer() {
  return { children: [] as unknown[] };
}

test.skip("mounts nested host elements", () => {
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

test.skip("mounts text, including adjacent strings as separate text nodes", () => {
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
