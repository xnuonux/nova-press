import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

// sentry build wrapper. source-map upload is skipped silently when
// SENTRY_AUTH_TOKEN is absent, so local + ci builds work with no sentry
// account wired. telemetry off.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
