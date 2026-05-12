import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { fetchManifest, resolveVersion } from "@/app/download/_lib";
import { captureServerEvent, identifyServerUser } from "@/lib/posthog-server";

const requestSchema = z.object({
  email: z.email(),
  platform: z.enum(["mac", "win"]),
  distinctId: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
});

const getIp = (requestHeaders: Headers) =>
  requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? undefined;

export const POST = async (request: Request) => {
  const json = await request.json().catch(() => null);
  const result = requestSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestHeaders = await headers();
  const { distinctId, email, path, platform } = result.data;
  const ip = getIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") ?? undefined;
  const manifest = await fetchManifest().catch(() => null);
  const resolvedVersion = manifest ? resolveVersion(manifest, "latest")?.version : undefined;

  await identifyServerUser({
    distinctId: email,
    anonymousDistinctId: distinctId && distinctId !== email ? distinctId : undefined,
    set: {
      email,
    },
  });

  await captureServerEvent({
    distinctId: email,
    event: "proofkit_download_request",
    properties: {
      email,
      platform,
      version: resolvedVersion,
      path,
      $current_url: path,
      $ip: ip,
      $user_agent: userAgent,
      original_distinct_id: distinctId,
    },
    set: {
      email,
    },
  });

  return NextResponse.json({ ok: true });
};
