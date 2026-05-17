import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { ENV } from "varlock/env";
import { MANIFEST_CACHE_TAG } from "@/app/download/_lib";

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
};

export const POST = (request: Request): Response => {
  const secret = ENV.PROOFKIT_MANIFEST_REVALIDATE_SECRET;
  if (!secret || getBearerToken(request) !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  revalidateTag(MANIFEST_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, tag: MANIFEST_CACHE_TAG });
};
