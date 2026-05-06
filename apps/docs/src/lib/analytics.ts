"use client";

import posthog from "posthog-js";

type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

const isPostHogEnabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);

export function captureEvent(event: string, properties: AnalyticsProperties = {}) {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.capture(event, {
    ...properties,
    path: typeof window === "undefined" ? undefined : window.location.pathname,
  });
}

export function trackDownloadClick(properties: {
  selectedPlatform: string;
  detectedPlatform: string;
  variant: string;
}) {
  captureEvent("download_cta_clicked", properties);
}

export function trackMarketingNavClick(properties: { destination: string; label: string; navSurface: string }) {
  captureEvent("marketing_nav_clicked", properties);
}

export function trackDocsActionClick(properties: { action: string; destination?: string; markdownUrl?: string }) {
  captureEvent("docs_action_clicked", properties);
}
