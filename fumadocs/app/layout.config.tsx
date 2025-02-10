import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    // can be JSX too!
    title: "ProofKit",
  },
  githubUrl: "https://github.com/proofgeist/proofkit",
  links: [
    {
      text: "Getting Started",
      url: "/docs/getting-started",
      active: "url",
    },
    {
      text: "CLI Docs",
      url: "/docs",
      active: "nested-url",
    },
  ],
};
