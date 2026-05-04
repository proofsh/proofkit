import { renderMermaidSVG } from "beautiful-mermaid";
// biome-ignore lint/performance/noNamespaceImport: fumadocs-ui/components/codeblock doesn't export named exports
import * as BaseCodeBlock from "fumadocs-ui/components/codeblock";

export function Mermaid({ chart }: { chart: string }) {
  try {
    const svg = renderMermaidSVG(chart, {
      bg: "var(--color-fd-background)",
      fg: "var(--color-fd-foreground)",
      interactive: true,
      transparent: true,
    });

    return (
      <div
        className="my-4 overflow-auto rounded-xl border bg-fd-card p-4"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid is rendered from local MDX content at build time.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  } catch {
    return (
      <BaseCodeBlock.CodeBlock title="Mermaid">
        <BaseCodeBlock.Pre>{chart}</BaseCodeBlock.Pre>
      </BaseCodeBlock.CodeBlock>
    );
  }
}
