import { NextResponse } from "next/server";
import { ENV } from "varlock/env";

const upstreamHost = ENV.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const buildUpstreamUrl = (path: string[], request: Request) => {
  const url = new URL(path.join("/"), upstreamHost.endsWith("/") ? upstreamHost : `${upstreamHost}/`);
  url.search = new URL(request.url).search;
  return url;
};

const proxy = async (request: Request, { params }: { params: Promise<{ path: string[] }> }) => {
  const { path } = await params;
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("host");

  const response = await fetch(buildUpstreamUrl(path, request), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
