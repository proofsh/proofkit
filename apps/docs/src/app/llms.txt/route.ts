export const revalidate = false;

const BASE_URL = "https://proofkit.proof.sh";

const START_HERE = [
  {
    title: "ProofKit AI",
    url: "/docs/ai",
    desc: "Agent-focused guide for building FileMaker apps with ProofKit",
  },
  {
    title: "Web Viewer Apps",
    url: "/docs/webviewer",
    desc: "Hybrid app model and FileMaker Web Viewer architecture",
  },
] as const;

const PACKAGES = [
  { name: "fmdapi", desc: "FileMaker Data API client (REST)" },
  { name: "fmodata", desc: "FileMaker OData API client with Drizzle-like ORM" },
  { name: "typegen", desc: "TypeScript type generator from FileMaker layouts" },
  { name: "cli", desc: "Interactive CLI for scaffolding ProofKit projects" },
  { name: "better-auth", desc: "Better Auth adapter for FileMaker" },
  { name: "webviewer", desc: "FileMaker Web Viewer utilities" },
] as const;

export function GET() {
  const lines = [
    "# ProofKit",
    "",
    "> TypeScript tools and libraries for building web applications integrated with Claris FileMaker",
    "",
    "## Start Here",
    "",
  ];

  for (const guide of START_HERE) {
    lines.push(`- [${guide.title}](${BASE_URL}${guide.url}): ${guide.desc}`);
  }

  lines.push("");
  lines.push("## Full Documentation");
  lines.push("");
  lines.push(`- [/llms-full.txt](${BASE_URL}/llms-full.txt): Complete documentation`);
  lines.push("");
  lines.push("## Package Documentation");
  lines.push("");
  for (const pkg of PACKAGES) {
    lines.push(`- [${pkg.name}](${BASE_URL}/llms/${pkg.name}): ${pkg.desc}`);
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
