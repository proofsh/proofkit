// biome-ignore lint/performance/noNamespaceImport: suggestion from docs
import * as Twoslash from "fumadocs-twoslash/ui";
import { createGenerator } from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { DownloadLink } from "@/components/DownloadLink";
import { Mermaid } from "@/components/Mermaid";
import { ThemedImage } from "@/components/ThemedImage";
import { YouTubeVideo } from "@/components/YouTubeVideo";

const generator = createGenerator();

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    AutoTypeTable: (props) => <AutoTypeTable {...props} generator={generator} />,
    DownloadLink,
    Mermaid,
    Tab,
    Tabs,
    ThemedImage,
    YouTubeVideo,
    ...Twoslash,
    ...components,
  };
}
