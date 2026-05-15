import { afterEach, describe, expect, it, vi } from "vitest";

const revalidateTagMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

vi.mock("varlock/env", () => ({
  ENV: {
    PROOFKIT_MANIFEST_REVALIDATE_SECRET: "secret-123",
  },
}));

describe("manifest revalidation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing bearer token", async () => {
    const { POST } = await import("@/app/api/proofkit/manifest/revalidate/route");

    const response = await POST(new Request("https://proofkit.test/api/proofkit/manifest/revalidate"));

    expect(response.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("revalidates manifest cache tag", async () => {
    const { POST } = await import("@/app/api/proofkit/manifest/revalidate/route");

    const response = await POST(
      new Request("https://proofkit.test/api/proofkit/manifest/revalidate", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-123",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      tag: "proofkit-manifest",
    });
    expect(revalidateTagMock).toHaveBeenCalledWith("proofkit-manifest", { expire: 0 });
  });
});
