import * as Sentry from "@sentry/nextjs";

// next.js server instrumentation hook. loads the sentry config for the
// active runtime so the SDK is ready (dormant without a dsn) before any
// request is handled.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// captures errors thrown in nested react server components so they reach
// sentry once a dsn is configured.
export const onRequestError = Sentry.captureRequestError;
