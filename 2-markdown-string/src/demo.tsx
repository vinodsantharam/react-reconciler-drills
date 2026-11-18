// Component trees to throw at your renderer. Render each one, read the
// instrumented log, and compare the Markdown with what you expected.

import { useEffect, useState } from "react";

// 1. A static document: every block type, inline formatting, a nested list.
export function Article() {
  return (
    <>
      <heading level={1}>Custom renderers</heading>
      <paragraph>
        React talks to the host through a <bold>host config</bold>, written by{" "}
        <italic>you</italic>. See the <anchor href="https://github.com/facebook/react">React repo</anchor>.
      </paragraph>
      <heading level={2}>Phases</heading>
      <list ordered>
        <listItem>Render: work out what changed</listItem>
        <listItem>
          Commit: apply it
          <list>
            <listItem>
              <inlineCode>prepareForCommit</inlineCode> first
            </listItem>
            <listItem>
              <inlineCode>resetAfterCommit</inlineCode> last
            </listItem>
          </list>
        </listItem>
      </list>
      <divider />
      <codeBlock language="ts">{"const root = createContainer(container);\nrender(<Article />, root);"}</codeBlock>
    </>
  );
}

// 2. State changes from outside render(): the output must follow on its own.
export function Counter({ onReady }: { onReady?: (inc: () => void) => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => onReady?.(() => setCount((c) => c + 1)), [onReady]);
  return <paragraph>count: {count}</paragraph>;
}

// 3. Keyed, ordered list: reorders and removals must renumber.
export function Steps({ steps, ordered = true }: { steps: string[]; ordered?: boolean }) {
  return (
    <list ordered={ordered}>
      {steps.map((s) => (
        <listItem key={s}>{s}</listItem>
      ))}
    </list>
  );
}

// 4. Toggle a block in and out of the middle of the document.
export function Toggle({ show }: { show: boolean }) {
  return (
    <>
      <paragraph>before</paragraph>
      {show && <paragraph>middle</paragraph>}
      <paragraph>after</paragraph>
    </>
  );
}
