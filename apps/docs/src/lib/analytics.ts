"use client";

import posthog from "posthog-js";
import { ENV } from "varlock/env";

type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

const isPostHogEnabled = Boolean(ENV.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);

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

export function trackDownloadRequest(properties: { email: string; platform: string }) {
  if (isPostHogEnabled) {
    posthog.identify(properties.email);
  }
  captureEvent("proofkit_download_request", properties);
}

export function trackDocsActionClick(properties: { action: string; destination?: string; markdownUrl?: string }) {
  captureEvent("docs_action_clicked", properties);
}

export function trackPromoVideoOpened(properties: { video_id: string; surface: string; video_url: string }) {
  captureEvent("promo_video_opened", properties);
}

export function trackPromoVideoClosed(properties: { video_id: string; surface: string }) {
  captureEvent("promo_video_closed", properties);
}
