import { renderMermaidSVG } from "beautiful-mermaid";
// biome-ignore lint/performance/noNamespaceImport: fumadocs-ui/components/codeblock doesn't export named exports
import * as BaseCodeBlock from "fumadocs-ui/components/codeblock";
import type { CSSProperties } from "react";

const MIN_MULTILINE_EDGE_LABEL_WIDTH = 112;
const EDGE_LABEL_GROUP_REGEX = /<g class="edge-label"[\s\S]*?<\/g>/g;
const EDGE_LABEL_RECT_REGEX = /<rect x="(?<x>[^"]+)" y="(?<y>[^"]+)" width="(?<width>[^"]+)" height="(?<height>[^"]+)"/;
const EDGE_LABEL_TEXT_X_REGEX = /(<(?:text|tspan)\b[^>]*\sx=")[^"]+/g;
const mermaidStyle = {
  "--accent": "color-mix(in srgb, var(--color-fd-foreground) 90%, var(--color-fd-card))",
  "--line": "color-mix(in srgb, var(--color-fd-foreground) 50%, var(--color-fd-card))",
  "--surface": "color-mix(in srgb, var(--color-fd-foreground) 6%, var(--color-fd-card))",
  "--border": "color-mix(in srgb, var(--color-fd-foreground) 22%, var(--color-fd-card))",
} as CSSProperties;

function normalizeMultilineEdgeLabels(svg: string) {
  return svg.replace(EDGE_LABEL_GROUP_REGEX, (group) => {
    const rect = group.match(EDGE_LABEL_RECT_REGEX);

    if (!rect?.groups) {
      return group;
    }

    const x = Number(rect.groups.x);
    const width = Number(rect.groups.width);
    const height = Number(rect.groups.height);

    if (height < 40 || width >= MIN_MULTILINE_EDGE_LABEL_WIDTH) {
      return group;
    }

    const center = x + width / 2;
    const normalizedX = center - MIN_MULTILINE_EDGE_LABEL_WIDTH / 2;

    return group
      .replace(`x="${rect.groups.x}"`, `x="${normalizedX}"`)
      .replace(`width="${rect.groups.width}"`, `width="${MIN_MULTILINE_EDGE_LABEL_WIDTH}"`)
      .replace(EDGE_LABEL_TEXT_X_REGEX, `$1${center}`);
  });
}

export function Mermaid({ chart }: { chart: string }) {
  try {
    const svg = normalizeMultilineEdgeLabels(
      renderMermaidSVG(chart, {
        bg: "var(--color-fd-background)",
        fg: "var(--color-fd-foreground)",
        interactive: true,
        transparent: true,
      }),
    );

    return (
      <div
        className="my-4 overflow-auto rounded-xl border bg-fd-card p-4 text-fd-foreground [&_.edge-label_text]:fill-current [&_.edge]:[stroke-dasharray:none]"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid is rendered from local MDX content at build time.
        dangerouslySetInnerHTML={{ __html: svg }}
        style={mermaidStyle}
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
