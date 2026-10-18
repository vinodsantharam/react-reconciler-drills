// Host element names used in demo.tsx. Edit these as your renderer grows.
// Names avoid real HTML/SVG tags so they don't merge with react-dom's types.
import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      box: { id?: string; children?: React.ReactNode };
      leaf: { count?: number; children?: React.ReactNode };
      item: React.Attributes & { id: string };
    }
  }
}
