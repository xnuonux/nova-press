import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// vitest harness for nova. node environment ... week 1 coverage is pure logic
// and route handlers. component and e2e tests come later.
export default defineConfig({
  // match next's automatic jsx runtime so component tests don't need React in
  // scope (server components like piece-body render via react-dom/server here).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a next.js build-time guard that throws if
      // imported into a client bundle. vitest doesn't run a real next
      // bundler, so alias it to an empty stub for tests.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
});
