import { notFound } from "next/navigation";
import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export const revalidate = false;

const PACKAGES = ["better-auth", "cli", "fmdapi", "fmodata", "typegen", "webviewer"] as const;

const PACKAGE_DESCRIPTIONS: Record<string, string> = {
  "better-auth": "Better Auth adapter for FileMaker authentication",
  cli: "Interactive CLI for scaffolding ProofKit projects",
  fmdapi: "FileMaker Data API client (REST)",
  fmodata: "FileMaker OData API client with Drizzle-like ORM",
  typegen: "TypeScript type generator from FileMaker layouts",
  webviewer: "FileMaker Web Viewer utilities",
};

export async function GET(_request: Request, props: { params: Promise<{ package: string }> }) {
  const params = await props.params;
  const pkg = params.package;

  if (!PACKAGES.includes(pkg as (typeof PACKAGES)[number])) {
    notFound();
  }

  const pages = source.getPages().filter((page) => page.slugs[0] === pkg);

  if (pages.length === 0) {
    notFound();
  }

  const results = await Promise.all(pages.map(getLLMText));

  const header = `# ProofKit: ${pkg}

> ${PACKAGE_DESCRIPTIONS[pkg] ?? ""}

Documentation for the @proofkit/${pkg} package.

---

`;

  return new Response(header + results.join("\n\n---\n\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export function generateStaticParams() {
  return PACKAGES.map((pkg) => ({ package: pkg }));
}
