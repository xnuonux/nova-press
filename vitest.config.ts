import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// vitest harness for nova. node environment ... week 1 coverage is pure logic
// and route handlers. component and e2e tests come later.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
