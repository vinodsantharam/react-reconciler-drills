// Host element names for the Markdown renderer. Edit these as your renderer grows.
// Names avoid real HTML tags (no <p>, <code>, <a>) so they don't merge with react-dom's types.
import "react";

type Children = { children?: React.ReactNode };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      // Blocks: allowed at the top level (and `list` also inside `listItem`).
      heading: Children & { level: 1 | 2 | 3 | 4 | 5 | 6 };
      paragraph: Children;
      list: Children & { ordered?: boolean };
      codeBlock: Children & { language?: string };
      divider: Children; // `---`. Takes no children; the type allows them so a test can check that.

      // Only directly inside a `list`.
      listItem: React.Attributes & Children;

      // Inline: allowed inside heading, paragraph, listItem and other inline elements.
      bold: Children;
      italic: Children;
      inlineCode: Children;
      anchor: Children & { href: string };
    }
  }
}
