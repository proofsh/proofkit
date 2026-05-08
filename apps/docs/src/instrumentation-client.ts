import posthog from "posthog-js";
import { ENV } from "varlock/env";

const posthogToken = ENV.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = ENV.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    autocapture: {
      capture_copied_text: false,
    },
    capture_pageleave: true,
    capture_pageview: true,
    defaults: "2026-01-30",
    disable_session_recording: true,
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") {
        client.debug();
      }
    },
  });
}
