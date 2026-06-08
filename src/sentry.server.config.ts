// sentry init for the node runtime. loaded by src/instrumentation.ts when
// NEXT_RUNTIME === "nodejs". dormant until SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";

import { sentryInitOptions } from "@/lib/observability/sentry-options";

Sentry.init(sentryInitOptions(process.env.SENTRY_DSN));
