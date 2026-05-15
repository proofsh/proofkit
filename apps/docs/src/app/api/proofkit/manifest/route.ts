import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { MANIFEST_FETCH_OPTIONS } from "@/app/download/_lib";

const MANIFEST_URL = "https://downloads.ottomatic.cloud/proofkit/manifest.json";

const assetSchema = z.object({
  file: z.string(),
  sha256: z.string(),
  size: z.number(),
  url: z.url(),
});

const manifestSchema = z.object({
  latestBetaVersion: z.string(),
  latestVersion: z.string(),
  product: z.string(),
  updatedAt: z.string(),
  versions: z.array(
    z.object({
      assets: z.array(assetSchema),
      version: z.string(),
    }),
  ),
});

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

export const OPTIONS = (): Response => new Response(null, { headers: corsHeaders });

export const GET = async (): Promise<Response> => {
  const response = await fetch(MANIFEST_URL, MANIFEST_FETCH_OPTIONS);
  if (!response.ok) {
    return NextResponse.json(
      { error: `Manifest fetch failed (${response.status})` },
      { headers: corsHeaders, status: 502 },
    );
  }

  const manifest = manifestSchema.parse(await response.json());
  return NextResponse.json(manifest, { headers: corsHeaders });
};
