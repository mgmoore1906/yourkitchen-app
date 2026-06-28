import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Source-map upload for readable stack traces. All optional: if these env vars
  // are absent the build still succeeds and errors are still captured — the only
  // difference is stack traces stay minified until you add them.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // No tunnelRoute on purpose — keeps your middleware.ts untouched. Can add later.
});
