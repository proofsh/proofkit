import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("varlock/env", () => ({
  ENV: {
    NEXT_PUBLIC_POSTHOG_HOST: "https://p.proof.sh",
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
  },
}));

describe("posthog server helpers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends capture payloads to posthog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { captureServerEvent } = await import("@/lib/posthog-server");

    await captureServerEvent({
      distinctId: "person-123",
      event: "proofkit_download_request",
      properties: {
        platform: "mac",
      },
      set: {
        email: "person@example.com",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/capture/");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      api_key: "phc_test",
      distinct_id: "person-123",
      event: "proofkit_download_request",
      properties: {
        platform: "mac",
      },
      $set: {
        email: "person@example.com",
      },
    });
  });

  it("sends identify payloads with anonymous distinct id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { identifyServerUser } = await import("@/lib/posthog-server");

    await identifyServerUser({
      distinctId: "person@example.com",
      anonymousDistinctId: "anon-123",
      set: {
        email: "person@example.com",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/capture/");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      api_key: "phc_test",
      distinct_id: "person@example.com",
      event: "$identify",
      properties: {
        distinct_id: "person@example.com",
        $anon_distinct_id: "anon-123",
      },
      $set: {
        email: "person@example.com",
      },
    });
  });
});
