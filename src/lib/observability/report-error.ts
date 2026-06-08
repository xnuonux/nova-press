import * as Sentry from "@sentry/nextjs";

// isomorphic error reporter (works server + client). routes to sentry and
// also console.errors so failures stay grep-able in vercel logs even while
// the dsn is absent and sentry is dormant.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
  console.error(error, context ?? "");
}
