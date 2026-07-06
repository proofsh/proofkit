"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { useEffect, useState } from "react";

/**
 * Renders an agent prompt as a copyable code block, substituting `{url}` in the
 * template with the page the reader is currently on. This keeps the referenced
 * URL correct across preview deployments and the production site, instead of
 * hard-coding a domain.
 */
export function AgentPrompt({
  template,
  fallbackUrl,
}: {
  /** Prompt text. Every `{url}` is replaced with the current page URL. */
  template: string;
  /** URL used during SSR and before hydration. */
  fallbackUrl: string;
}) {
  const [url, setUrl] = useState(fallbackUrl);

  useEffect(() => {
    setUrl(`${window.location.origin}${window.location.pathname}`);
  }, []);

  return <DynamicCodeBlock code={template.replaceAll("{url}", url)} lang="text" />;
}

export default AgentPrompt;
