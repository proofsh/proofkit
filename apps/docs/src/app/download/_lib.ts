import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { captureServerEvent } from "@/lib/posthog-server";

const MANIFEST_URL = "https://downloads.ottomatic.cloud/proofkit/manifest.json";
const MANIFEST_REVALIDATE_SECONDS = 300;

export const platformSchema = z.enum(["mac", "win"]);
export type Platform = z.infer<typeof platformSchema>;

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const versionSelectorSchema = z.union([
  z.literal("latest"),
  z.literal("beta"),
  z.string().regex(versionPattern, "Version must be 'latest', 'beta', or semver."),
]);
export type VersionSelector = z.infer<typeof versionSelectorSchema>;

const assetSchema = z.object({
  file: z.string(),
  sha256: z.string(),
  size: z.number(),
  url: z.url(),
});

const versionEntrySchema = z.object({
  version: z.string(),
  assets: z.array(assetSchema),
});

const manifestSchema = z.object({
  product: z.string(),
  updatedAt: z.string(),
  latestVersion: z.string(),
  latestBetaVersion: z.string(),
  versions: z.array(versionEntrySchema),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestAsset = z.infer<typeof assetSchema>;
export type ManifestVersion = z.infer<typeof versionEntrySchema>;

export const fetchManifest = async (): Promise<Manifest> => {
  const response = await fetch(MANIFEST_URL, {
    next: { revalidate: MANIFEST_REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`Manifest fetch failed (${response.status})`);
  }
  return manifestSchema.parse(await response.json());
};

const pickAsset = (assets: ManifestAsset[], platform: Platform): ManifestAsset | null => {
  const candidates = assets.filter((asset) => {
    const file = asset.file.toLowerCase();
    if (file.startsWith("sha256sums")) {
      return false;
    }
    return platform === "mac" ? file.endsWith(".pkg") : file.endsWith(".exe");
  });

  if (candidates.length === 0) {
    return null;
  }

  if (platform === "win") {
    const signed = candidates.find((asset) => !asset.file.toLowerCase().includes("unsigned"));
    if (signed) {
      return signed;
    }
  }

  if (platform === "mac") {
    const signed = candidates.find((asset) => asset.file.toLowerCase().includes("signed"));
    if (signed) {
      return signed;
    }
  }

  return candidates[0] ?? null;
};

export const resolveVersion = (manifest: Manifest, selector: VersionSelector): ManifestVersion | null => {
  if (selector === "latest") {
    const target = manifest.latestVersion || manifest.latestBetaVersion;
    return manifest.versions.find((entry) => entry.version === target) ?? null;
  }

  if (selector === "beta") {
    return manifest.versions.find((entry) => entry.version === manifest.latestBetaVersion) ?? null;
  }

  return manifest.versions.find((entry) => entry.version === selector) ?? null;
};

const errorResponse = (message: string, status: number) => NextResponse.json({ error: message }, { status });

const getIp = (requestHeaders: Headers) =>
  requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? undefined;

const parsePostHogDistinctId = (value: string): string | undefined => {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "distinct_id" in parsed &&
      typeof parsed.distinct_id === "string" &&
      parsed.distinct_id.length > 0
    ) {
      return parsed.distinct_id;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getDistinctId = (request: Request): string => {
  const url = new URL(request.url);
  const queryDistinctId =
    url.searchParams.get("distinct_id") ??
    url.searchParams.get("distinctId") ??
    url.searchParams.get("ph_distinct_id") ??
    url.searchParams.get("email");
  if (queryDistinctId) {
    return queryDistinctId;
  }

  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    const name = rawName?.trim();
    const value = rawValue.join("=");
    if (name?.startsWith("ph_") && name.endsWith("_posthog") && value) {
      const distinctId = parsePostHogDistinctId(value);
      if (distinctId) {
        return distinctId;
      }
    }
  }

  return "anonymous_download";
};

const captureDownload = async (
  request: Request,
  input: { asset: ManifestAsset; platform: Platform; version: string },
) => {
  const url = new URL(request.url);

  await captureServerEvent({
    distinctId: getDistinctId(request),
    event: "proofkit_download",
    properties: {
      platform: input.platform,
      version: input.version,
      asset_file: input.asset.file,
      asset_url: input.asset.url,
      path: url.pathname,
      $current_url: request.url,
      $ip: getIp(request.headers),
      $user_agent: request.headers.get("user-agent") ?? undefined,
    },
  });
};

export const handleDownload = async (
  rawParams: { platform: string; version?: string },
  request: Request,
): Promise<Response> => {
  const platformResult = platformSchema.safeParse(rawParams.platform);
  if (!platformResult.success) {
    return errorResponse("Platform must be 'mac' or 'win'.", 400);
  }

  const versionInput = rawParams.version ?? "latest";
  const versionResult = versionSelectorSchema.safeParse(versionInput);
  if (!versionResult.success) {
    return errorResponse(versionResult.error.issues[0]?.message ?? "Invalid version.", 400);
  }

  let manifest: Manifest;
  try {
    manifest = await fetchManifest();
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Manifest unavailable.", 502);
  }

  const versionEntry = resolveVersion(manifest, versionResult.data);
  if (!versionEntry) {
    return errorResponse(`Version '${versionInput}' not found.`, 404);
  }

  const asset = pickAsset(versionEntry.assets, platformResult.data);
  if (!asset) {
    return errorResponse(
      `No ${platformResult.data === "mac" ? "macOS" : "Windows"} asset found for version ${versionEntry.version}.`,
      404,
    );
  }

  await captureDownload(request, {
    asset,
    platform: platformResult.data,
    version: versionEntry.version,
  }).catch((error: unknown) => {
    console.error("Download telemetry failed", error);
  });

  return NextResponse.redirect(asset.url, 302);
};
