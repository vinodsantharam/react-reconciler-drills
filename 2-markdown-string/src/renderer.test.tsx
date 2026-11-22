// What drill 2 should produce. These tests pin down the Markdown output, so they
// fail until you write src/renderer.ts. If you'd rather use a different Markdown
// style, change the expected strings here first, then make the tests pass.
//
// The contract assumed here:
//   - `render(element, container)` is exported from ./renderer.
//   - It is synchronous: `container.output` is up to date when it returns.
//   - Calling it again with the same container updates the existing tree.
//   - After EVERY commit, including ones caused by a state update outside render(),
//     `container.output` holds the whole document, and `container.onChange?.(output)`
//     is called exactly once.
//   - `render()` throws if the tree puts something where Markdown doesn't allow it.
//
// The Markdown rules:
//   - Blocks are joined by one blank line, and a non-empty document ends with "\n".
//     An empty document is "".
//   - heading:   "#" repeated `level` times, a space, then the inline content.
//   - paragraph: the inline content.
//   - list:      one line per listItem. Marker "- ", or "1. ", "2. "… when `ordered`.
//                A list inside a listItem goes on the following lines, each indented
//                by the width of the parent's marker ("- " = 2 spaces, "1. " = 3).
//   - codeBlock: "```" + language (if any), newline, the text as-is, newline, "```".
//   - divider:   "---".
//   - bold "**x**", italic "_x_", inlineCode "`x`", anchor "[x](href)".
//   - In normal text, the characters \ * _ ` [ ] are escaped with a backslash.
//     Text inside inlineCode and codeBlock is never escaped.
//
// Where things are allowed (anything else makes render() throw):
//   - Top level: heading, paragraph, list, codeBlock, divider.
//   - Inside heading, paragraph, listItem, bold, italic, anchor: text and inline
//     elements (bold, italic, inlineCode, anchor). A listItem may also hold a list.
//   - Inside list: listItem only. No text.
//   - Inside codeBlock and inlineCode: text only.
//   - Inside divider: nothing.

import { createElement, type ReactNode } from "react";
import { render, type Container } from "./renderer";
import { Article, Counter, Steps, Toggle } from "./demo";

function newContainer(onChange?: (output: string) => void): Container {
  return { output: "", onChange };
}

// Renders into a fresh container and returns the Markdown.
function md(element: ReactNode): string {
  const container = newContainer();
  render(element, container);
  return container.output;
}

describe("blocks", () => {
  test.only("1: an empty document is an empty string", () => {
    expect(md(null)).toBe("");
  });

  test.only("2: a heading uses one # per level", () => {
    expect(md(<heading level={1}>Title</heading>)).toBe("# Title\n");
    expect(md(<heading level={3}>Deep</heading>)).toBe("### Deep\n");
  });

  test.only("3: a paragraph joins its text children", () => {
    expect(md(<paragraph>{"one"} {"two"}</paragraph>)).toBe("one two\n");
  });

  test.only("4: a number child is text", () => {
    expect(md(<heading level={2}>{3} steps</heading>)).toBe("## 3 steps\n");
  });

  test.only("5: blocks are separated by a blank line", () => {
    const output = md(
      <>
        <heading level={1}>A</heading>
        <paragraph>B</paragraph>
        <paragraph>C</paragraph>
      </>,
    );
    expect(output).toBe("# A\n\nB\n\nC\n");
  });

  test.only("6: a divider is ---", () => {
    const output = md(
      <>
        <paragraph>above</paragraph>
        <divider />
        <paragraph>below</paragraph>
      </>,
    );
    expect(output).toBe("above\n\n---\n\nbelow\n");
  });

  test.only("7: a code block keeps its language and its text as-is", () => {
    expect(md(<codeBlock language="ts">{"let a = 1;\nlet b = 2;"}</codeBlock>)).toBe(
      "```ts\nlet a = 1;\nlet b = 2;\n```\n",
    );
  });

  test.only("8: a code block without a language", () => {
    expect(md(<codeBlock>{"plain"}</codeBlock>)).toBe("```\nplain\n```\n");
  });

  test.only("9: a code block joins several text children", () => {
    const name = "x";
    expect(md(<codeBlock>let {name} = 1;</codeBlock>)).toBe("```\nlet x = 1;\n```\n");
  });
});

describe("inline", () => {
  test.only("10: bold, italic and inline code inside a paragraph", () => {
    const output = md(
      <paragraph>
        a <bold>b</bold> <italic>c</italic> <inlineCode>d</inlineCode>
      </paragraph>,
    );
    expect(output).toBe("a **b** _c_ `d`\n");
  });

  test.only("11: inline elements nest", () => {
    expect(md(<paragraph><bold>a <italic>b</italic></bold></paragraph>)).toBe("**a _b_**\n");
  });

  test.only("12: an anchor wraps its content and keeps its href", () => {
    expect(md(<paragraph>see <anchor href="https://react.dev">the <bold>docs</bold></anchor></paragraph>)).toBe(
      "see [the **docs**](https://react.dev)\n",
    );
  });

  test.only("13: inline elements work inside headings", () => {
    expect(md(<heading level={2}>Use <inlineCode>render</inlineCode></heading>)).toBe("## Use `render`\n");
  });
});

describe("escaping", () => {
  test.only("14: Markdown characters in normal text are escaped", () => {
    expect(md(<paragraph>{"2 * 3, snake_case, [x], `y`, a\\b"}</paragraph>)).toBe(
      "2 \\* 3, snake\\_case, \\[x\\], \\`y\\`, a\\\\b\n",
    );
  });

  test.only("15: escaping applies inside headings and inline elements too", () => {
    expect(md(<heading level={1}>a_b <bold>c*d</bold></heading>)).toBe("# a\\_b **c\\*d**\n");
  });

  test("16: text inside inline code is not escaped", () => {
    expect(md(<paragraph><inlineCode>a*b_c</inlineCode></paragraph>)).toBe("`a*b_c`\n");
  });

  test.only("17: text inside a code block is not escaped", () => {
    expect(md(<codeBlock>{"**not bold** [x]"}</codeBlock>)).toBe("```\n**not bold** [x]\n```\n");
  });
});

describe("lists", () => {
  test.only("18: an unordered list", () => {
    expect(md(<Steps ordered={false} steps={["a", "b"]} />)).toBe("- a\n- b\n");
  });

  test.only("19: an ordered list is numbered from 1", () => {
    expect(md(<Steps steps={["a", "b", "c"]} />)).toBe("1. a\n2. b\n3. c\n");
  });

  test.only("20: list items hold inline elements", () => {
    expect(md(<list><listItem>use <bold>keys</bold></listItem></list>)).toBe("- use **keys**\n");
  });

  test.only("21: a nested list is indented by the parent's marker width", () => {
    const output = md(
      <list>
        <listItem>
          a
          <list>
            <listItem>b</listItem>
          </list>
        </listItem>
      </list>,
    );
    expect(output).toBe("- a\n  - b\n");
  });

  test.only("22: nesting under an ordered item indents by 3", () => {
    const output = md(
      <list ordered>
        <listItem>
          a
          <list>
            <listItem>b</listItem>
            <listItem>c</listItem>
          </list>
        </listItem>
        <listItem>d</listItem>
      </list>,
    );
    expect(output).toBe("1. a\n   - b\n   - c\n2. d\n");
  });

  test.only("23: three levels deep", () => {
    const output = md(
      <list>
        <listItem>
          a
          <list>
            <listItem>
              b
              <list ordered>
                <listItem>c</listItem>
              </list>
            </listItem>
          </list>
        </listItem>
      </list>,
    );
    expect(output).toBe("- a\n  - b\n    1. c\n");
  });

  test("24: a list between other blocks", () => {
    const output = md(
      <>
        <paragraph>Steps:</paragraph>
        <Steps steps={["one"]} />
        <paragraph>Done.</paragraph>
      </>,
    );
    expect(output).toBe("Steps:\n\n1. one\n\nDone.\n");
  });
});

// Each "throws" test first checks that a valid document renders, so a renderer
// that throws on everything (like the starting stub) can't pass them.
function expectToThrow(run: () => unknown) {
  expect(md(<paragraph>ok</paragraph>)).toBe("ok\n");
  expect(run).toThrow();
}

describe("where things are allowed", () => {
  // Positive control: deep nesting of allowed things must not throw.
  test.only("25: text deep inside allowed elements is fine", () => {
    expect(() =>
      md(
        <list>
          <listItem>
            <anchor href="#">
              <bold>
                <italic>ok</italic>
              </bold>
            </anchor>
          </listItem>
        </list>,
      ),
    ).not.toThrow();
  });

  test.only("26: text at the top level throws", () => {
    expectToThrow(() => md(<>hello</>));
  });

  test.only("27: text directly inside a list throws", () => {
    expectToThrow(() => md(<list>oops</list>));
  });

  test.only("28: an inline element at the top level throws", () => {
    expectToThrow(() => md(<bold>loud</bold>));
  });

  test.only("29: a block inside a paragraph throws", () => {
    expectToThrow(() => md(<paragraph><heading level={1}>no</heading></paragraph>));
  });

  test.only("30: a list item outside a list throws", () => {
    expectToThrow(() => md(<listItem>alone</listItem>));
  });

  test.only("31: a list item inside a paragraph throws", () => {
    expectToThrow(() => md(<paragraph><listItem>no</listItem></paragraph>));
  });

  test.only("32: an element inside a code block throws", () => {
    expectToThrow(() => md(<codeBlock><bold>x</bold></codeBlock>));
  });

  test.only("33: an element inside inline code throws", () => {
    expectToThrow(() => md(<paragraph><inlineCode><italic>x</italic></inlineCode></paragraph>));
  });

  test.only("34: anything inside a divider throws", () => {
    expectToThrow(() => md(<divider>text</divider>));
  });

  test.only("35: an unknown element type throws", () => {
    expectToThrow(() => md(createElement("blink", null, "hi")));
  });

  test.only("36: misplaced text added by an update throws", () => {
    const container = newContainer();
    render(<list><listItem>a</listItem></list>, container);
    expectToThrow(() => render(<list><listItem>a</listItem>stray</list>, container));
  });
});

describe("updates", () => {
  test.only("37: changing text updates the output", () => {
    const container = newContainer();
    render(<paragraph>count: {1}</paragraph>, container);
    render(<paragraph>count: {2}</paragraph>, container);
    expect(container.output).toBe("count: 2\n");
  });

  test.only("38: changing a heading's level", () => {
    const container = newContainer();
    render(<heading level={1}>T</heading>, container);
    render(<heading level={2}>T</heading>, container);
    expect(container.output).toBe("## T\n");
  });

  test.only("39: changing an anchor's href", () => {
    const container = newContainer();
    render(<paragraph><anchor href="/a">x</anchor></paragraph>, container);
    render(<paragraph><anchor href="/b">x</anchor></paragraph>, container);
    expect(container.output).toBe("[x](/b)\n");
  });

  test.only("40: removing a block from the middle", () => {
    const container = newContainer();
    render(<Toggle show={true} />, container);
    expect(container.output).toBe("before\n\nmiddle\n\nafter\n");
    render(<Toggle show={false} />, container);
    expect(container.output).toBe("before\n\nafter\n");
  });

  test("41: inserting a block into the middle", () => {
    const container = newContainer();
    render(<Toggle show={false} />, container);
    render(<Toggle show={true} />, container);
    expect(container.output).toBe("before\n\nmiddle\n\nafter\n");
  });

  test("42: reordering keyed list items", () => {
    const container = newContainer();
    render(<Steps steps={["a", "b", "c"]} />, container);
    render(<Steps steps={["c", "a", "b"]} />, container);
    expect(container.output).toBe("1. c\n2. a\n3. b\n");
  });

  test("43: removing the first item renumbers the rest", () => {
    const container = newContainer();
    render(<Steps steps={["a", "b", "c"]} />, container);
    render(<Steps steps={["b", "c"]} />, container);
    expect(container.output).toBe("1. b\n2. c\n");
  });

  test("44: switching a list from ordered to unordered", () => {
    const container = newContainer();
    render(<Steps steps={["a", "b"]} />, container);
    render(<Steps ordered={false} steps={["a", "b"]} />, container);
    expect(container.output).toBe("- a\n- b\n");
  });

  test("45: changing a code block's text", () => {
    const container = newContainer();
    render(<codeBlock>{"one"}</codeBlock>, container);
    render(<codeBlock>{"two"}</codeBlock>, container);
    expect(container.output).toBe("```\ntwo\n```\n");
  });

  test("46: replacing a paragraph's text with a bold element", () => {
    const container = newContainer();
    render(<paragraph>hi</paragraph>, container);
    render(<paragraph><bold>hi</bold></paragraph>, container);
    expect(container.output).toBe("**hi**\n");
  });

  test("47: rendering null empties the document", () => {
    const container = newContainer();
    render(<Toggle show={true} />, container);
    render(null, container);
    expect(container.output).toBe("");
  });
});

describe("commits", () => {
  test("48: onChange is called once per commit, with the new output", () => {
    const onChange = vi.fn();
    const container = newContainer(onChange);

    render(<Steps steps={["a", "b", "c"]} />, container);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("1. a\n2. b\n3. c\n");

    // Several changes in one commit: a reorder, a removal and an insertion.
    render(<Steps steps={["c", "d", "a"]} />, container);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("1. c\n2. d\n3. a\n");
  });

  test("49: a state update outside render() still updates the output", async () => {
    const onChange = vi.fn();
    const container = newContainer(onChange);
    let increment: (() => void) | undefined;

    render(<Counter onReady={(inc) => (increment = inc)} />, container);
    expect(container.output).toBe("count: 0\n");

    await vi.waitFor(() => expect(increment).toBeDefined());
    increment!();

    // No render() call here: React commits on its own schedule.
    await vi.waitFor(() => expect(container.output).toBe("count: 1\n"));
    expect(onChange).toHaveBeenLastCalledWith("count: 1\n");
  });

  test("50: the Article demo renders the whole document", () => {
    expect(md(<Article />)).toBe(
      [
        "# Custom renderers",
        "",
        "React talks to the host through a **host config**, written by _you_. See the [React repo](https://github.com/facebook/react).",
        "",
        "## Phases",
        "",
        "1. Render: work out what changed",
        "2. Commit: apply it",
        "   - `prepareForCommit` first",
        "   - `resetAfterCommit` last",
        "",
        "---",
        "",
        "```ts",
        "const root = createContainer(container);",
        "render(<Article />, root);",
        "```",
        "",
      ].join("\n"),
    );
  });
});
