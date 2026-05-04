import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rehypeCodeDefaultOptions, remarkMdxMermaid, remarkNpm } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { transformerTwoslash } from "fumadocs-twoslash";
import type { LanguageRegistration, ShikiTransformer } from "shiki";

import FileMakerLang from "./src/lib/FileMaker-tmLanguage.json";

// Options: https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid, [remarkNpm, { persist: { id: "package-manager" } }]],
    rehypeCodeOptions: {
      // You might want to configure themes here as well
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      langs: ["ts", "tsx", "js", "javascript", "json", FileMakerLang as LanguageRegistration],
      transformers: [
        ...((rehypeCodeDefaultOptions.transformers ?? []) as ShikiTransformer[]),
        (() => {
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          const tryPaths = [
            path.resolve(process.cwd(), "apps/docs/content/docs/fmdapi/CustomersLayout.ts"),
            path.resolve(process.cwd(), "content/docs/fmdapi/CustomersLayout.ts"),
            path.resolve(__dirname, "content/docs/fmdapi/CustomersLayout.ts"),
          ];

          let customersLayoutSource = "";
          for (const candidate of tryPaths) {
            if (!fs.existsSync(candidate)) {
              continue;
            }
            try {
              customersLayoutSource = fs.readFileSync(candidate, "utf8");
              break; // only break after a successful read
            } catch {
              // try next candidate
            }
          }

          // Only inject when we successfully read the file; otherwise let it error visibly
          const extraFiles: Record<string, string> | undefined = customersLayoutSource
            ? {
                "CustomersLayout.ts": customersLayoutSource,
                "./CustomersLayout.ts": customersLayoutSource,
                "./CustomersLayout": customersLayoutSource,
              }
            : undefined;

          return transformerTwoslash({
            twoslashOptions: {
              fsCache: true,
              extraFiles,
            },
          }) as ShikiTransformer;
        })(),
      ] as ShikiTransformer[],
    },
  },
});
