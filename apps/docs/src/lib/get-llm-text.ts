import type { InferPageType } from "fumadocs-core/source";
import type { source } from "./source";

export async function getLLMText(page: InferPageType<typeof source>): Promise<string> {
  const content = await page.data.getText("processed");

  return `# ${page.data.title}
URL: https://proofkit.proof.sh${page.url}

${page.data.description ?? ""}

${content}`.trim();
}
