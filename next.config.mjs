import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // the epub builder (jsdom + archiver + node fs) must not be bundled by the
  // server compiler ... left external, it loads at runtime from node_modules the
  // way it expects, so its filesystem render works.
  serverExternalPackages: ["@lesjoursfr/html-to-epub"],
};

// sentry build wrapper. source-map upload is skipped silently when
// SENTRY_AUTH_TOKEN is absent, so local + ci builds work with no sentry
// account wired. telemetry off.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
