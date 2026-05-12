import { ENV } from "varlock/env";

type PostHogProperties = Record<string, boolean | number | string | null | undefined>;

const posthogHost = ENV.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const posthogProjectToken = ENV.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

const joinPostHogUrl = (path: string) => new URL(path, posthogHost.endsWith("/") ? posthogHost : `${posthogHost}/`);

export async function captureServerEvent(input: {
  distinctId: string;
  event: string;
  properties?: PostHogProperties;
  set?: PostHogProperties;
}) {
  if (!posthogProjectToken) {
    return;
  }

  await fetch(joinPostHogUrl("/capture/"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      api_key: posthogProjectToken,
      distinct_id: input.distinctId,
      event: input.event,
      properties: input.properties,
      $set: input.set,
    }),
  });
}

export async function identifyServerUser(input: {
  distinctId: string;
  anonymousDistinctId?: string;
  set?: PostHogProperties;
}) {
  if (!posthogProjectToken) {
    return;
  }

  await fetch(joinPostHogUrl("/capture/"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      api_key: posthogProjectToken,
      distinct_id: input.distinctId,
      event: "$identify",
      properties: {
        distinct_id: input.distinctId,
        $anon_distinct_id: input.anonymousDistinctId,
      },
      $set: input.set,
    }),
  });
}
