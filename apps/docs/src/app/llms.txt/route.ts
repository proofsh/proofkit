export const revalidate = false;

const PACKAGES = [
  { name: "fmdapi", desc: "FileMaker Data API client (REST)" },
  { name: "fmodata", desc: "FileMaker OData API client with Drizzle-like ORM" },
  { name: "typegen", desc: "TypeScript type generator from FileMaker layouts" },
  { name: "cli", desc: "Interactive CLI for scaffolding ProofKit projects" },
  { name: "better-auth", desc: "Better Auth adapter for FileMaker" },
  { name: "webviewer", desc: "FileMaker WebViewer utilities" },
] as const;

export function GET() {
  const lines = [
    "# ProofKit",
    "",
    "> TypeScript tools and libraries for building web applications integrated with Claris FileMaker",
    "",
    "## Packages",
    "",
  ];

  for (const pkg of PACKAGES) {
    lines.push(`- [${pkg.name}](https://proofkit.proof.sh/llms/${pkg.name}): ${pkg.desc}`);
  }

  lines.push("");
  lines.push("## Full Documentation");
  lines.push("");
  lines.push("- [/llms-full.txt](https://proofkit.proof.sh/llms-full.txt): Complete documentation (all packages)");
  lines.push("");
  lines.push("## Per-Package Documentation");
  lines.push("");
  for (const pkg of PACKAGES) {
    lines.push(`- [/llms/${pkg.name}](https://proofkit.proof.sh/llms/${pkg.name})`);
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
