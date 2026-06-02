// vitest stub for next.js's `server-only` package. the real one throws
// at module-load time if imported into a client bundle. vitest doesn't
// run a real next bundler, so resolve to this empty module during tests.
// see vitest.config.ts for the alias wiring.
export {};
