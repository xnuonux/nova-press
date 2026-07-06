import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // the epub builder (jsdom + archiver + node fs) must not be bundled by the
  // server compiler ... left external, it loads at runtime from node_modules the
  // way it expects, so its filesystem render works. the typeset chain rides the
  // same rule: puppeteer-core + the serverless chromium resolve real files at
  // runtime, pagedjs is require.resolve'd as a browser script, and playwright is
  // a devDependency the pdf renderer only tries locally (external keeps the
  // missing-in-prod import a clean runtime failure instead of a build break).
  serverExternalPackages: [
    "@lesjoursfr/html-to-epub",
    "puppeteer-core",
    "@sparticuz/chromium",
    "pagedjs",
    "playwright",
  ],
};

// sentry build wrapper. source-map upload is skipped silently when
// SENTRY_AUTH_TOKEN is absent, so local + ci builds work with no sentry
// account wired. telemetry off.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
