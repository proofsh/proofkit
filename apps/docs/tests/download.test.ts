import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchManifest, type Manifest, resolveVersion } from "@/app/download/_lib";

vi.mock("varlock/env", () => ({
  ENV: {},
}));

const manifest: Manifest = {
  latestBetaVersion: "2.2.0-beta.0",
  latestVersion: "2.1.1",
  product: "proofkit",
  updatedAt: "2026-05-15T22:37:06.426Z",
  versions: [
    {
      assets: [],
      version: "2.1.1",
    },
    {
      assets: [
        {
          file: "proofkit-2.2.0-beta.0.pkg",
          sha256: "962f602af6112c452cb6525f46fd23acb335d04a03e4122ded2d486d927f2dfb",
          size: 54_835_640,
          url: "https://downloads.ottomatic.cloud/proofkit/2.2.0-beta.0/proofkit-2.2.0-beta.0.pkg",
        },
      ],
      version: "2.2.0-beta.0",
    },
  ],
};

describe("download manifest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves beta to latest beta version", () => {
    expect(resolveVersion(manifest, "beta")?.version).toBe("2.2.0-beta.0");
  });

  it("tags the cached manifest fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(manifest));
    vi.stubGlobal("fetch", fetchMock);

    await fetchManifest();

    expect(fetchMock).toHaveBeenCalledWith("https://downloads.ottomatic.cloud/proofkit/manifest.json", {
      next: {
        revalidate: 300,
        tags: ["proofkit-manifest"],
      },
    });
  });
});
