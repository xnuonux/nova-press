import type { BrowserOptions } from "@sentry/nextjs";

// shared sentry init options for every runtime (browser, node, edge).
//
// the SDK is DORMANT until a dsn is present in env ... `enabled: false`
// makes Sentry.init a clean no-op and suppresses the "no dsn, SDK
// disabled" console warning. it lights up the moment dom drops a real
// SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN, with zero code change.
//
// tracesSampleRate is 0 ... errors only for v1, no performance-tracing
// overhead or quota burn. bump it when tracing is wanted.
export function sentryInitOptions(dsn: string | undefined): BrowserOptions {
  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    tracesSampleRate: 0,
  };
}
