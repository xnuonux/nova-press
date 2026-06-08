// sentry init for the browser. next.js loads this on the client before
// hydration. dormant until NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";

import { sentryInitOptions } from "@/lib/observability/sentry-options";

Sentry.init(sentryInitOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

// lets sentry tie navigations together once a dsn is configured.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
