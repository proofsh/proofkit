import posthog from "posthog-js";
import { ENV } from "varlock/env";

const posthogToken = ENV.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = "/api/posthog";
const isPostHogEnabled = process.env.NODE_ENV === "production" && Boolean(posthogToken);

if (isPostHogEnabled) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    autocapture: {
      capture_copied_text: false,
    },
    capture_pageleave: true,
    capture_pageview: true,
    defaults: "2026-01-30",
    disable_session_recording: true,
  });
}
