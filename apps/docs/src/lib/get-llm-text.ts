import fs from "node:fs/promises";
import nodePath from "node:path";
import type { InferPageType } from "fumadocs-core/source";
import type { source } from "./source";

const FRONTMATTER_REGEX = /^---[\s\S]*?---\n?([\s\S]*)$/;

export async function getLLMText(page: InferPageType<typeof source>): Promise<string> {
  // Read raw MDX content - construct path from slugs
  let content = "";
  const filePath = `${page.slugs.join("/")}.mdx`;

  // Try both direct path and index.mdx for directory pages
  const pathsToTry = [
    nodePath.join(process.cwd(), "content/docs", filePath),
    nodePath.join(process.cwd(), "content/docs", page.slugs.join("/"), "index.mdx"),
  ];

  for (const mdxPath of pathsToTry) {
    try {
      const raw = await fs.readFile(mdxPath, "utf-8");
      // Remove frontmatter (--- ... ---)
      const match = raw.match(FRONTMATTER_REGEX);
      content = match?.[1]?.trim() ?? raw;
      break;
    } catch {
      // Try next path
    }
  }

  return `# ${page.data.title}
URL: https://proofkit.proof.sh${page.url}

${page.data.description ?? ""}

${content}`.trim();
}
