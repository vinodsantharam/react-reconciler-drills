import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same JSX setting as tsconfig.json: classic runtime, factory `h`.
  // development: false stops the compiler from adding __self and __source props.
  oxc: {
    jsx: { runtime: "classic", pragma: "h", development: false },
  },
  test: {
    globals: true,
  },
});
