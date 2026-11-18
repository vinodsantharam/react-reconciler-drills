// Drill 2: render a React tree to a Markdown string.
// The contract is described at the top of renderer.test.tsx. Everything below is yours to write.

import type { ReactNode } from "react";

export type Container = {
  // The whole document as Markdown, updated after every commit.
  output: string;
  // Called once per commit with the new output.
  onChange?: (output: string) => void;
};

export function render(element: ReactNode, container: Container): void {
  throw new Error("not implemented yet");
}
