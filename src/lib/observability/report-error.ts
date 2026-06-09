import * as Sentry from "@sentry/nextjs";

// isomorphic error reporter (works server + client). routes to sentry, and
// also console.errors when sentry can't (no dsn) or in dev ... so failures
// stay grep-able while dormant, without double-logging in prod once sentry
// is live and capturing.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
  const sentryActive = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!sentryActive || process.env.NODE_ENV === "development") {
    console.error(error, context ?? "");
  }
}
