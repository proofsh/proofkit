// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

import vercel from "@astrojs/vercel/serverless";

import react from "@astrojs/react";

import tailwind from "@astrojs/tailwind";
import starlightLlmsTxt from "starlight-llms-txt";

// https://astro.build/config
export default defineConfig({
  site: "https://proofkit.dev",
  integrations: [
    starlight({
      description:
        "ProofKit is a CLI tool for quickly building JavaScript apps.",
      plugins: [starlightLlmsTxt({ projectName: "ProofKit CLI" })],
      title: "ProofKit CLI",
      social: {
        github: "https://github.com/proofgeist/proofkit",
      },
      components: {
        Header: "./src/components/Header.astro",
      },
      sidebar: [
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
        {
          label: "Webviewer",
          autogenerate: { directory: "webviewer" },
        },
        {
          label: "Auth",
          autogenerate: { directory: "auth" },
        },
        {
          label: "Templates",
          autogenerate: { directory: "templates" },
        },
      ],
    }),
    react(),
    tailwind(),
  ],
  redirects: {
    "/auth/proofkit": "/auth/fm-addon",
  },

  output: "server",
  adapter: vercel(),
});
