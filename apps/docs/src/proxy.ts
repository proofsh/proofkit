import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const { rewrite: rewriteLLM } = rewritePath("/docs{/*path}", "/llms.mdx/docs{/*path}");
const MDX_DOCS_PATH_REGEX = /^\/docs\/(.+)\.mdx$/;

export default function proxy(request: NextRequest) {
  const mdxPath = request.nextUrl.pathname.match(MDX_DOCS_PATH_REGEX)?.[1];
  if (mdxPath) {
    return NextResponse.rewrite(new URL(`/llms.mdx/docs/${mdxPath}`, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}
