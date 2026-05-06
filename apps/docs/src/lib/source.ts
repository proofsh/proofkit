// import { createReactComponent, iconsList,   } from "@tabler/icons-react"; // Remove this

import { docs } from "fumadocs-mdx:collections/server";
// biome-ignore lint/performance/noNamespaceImport: suggestion from docs
import * as TablerIcons from "@tabler/icons-react"; // Add this
import { loader } from "fumadocs-core/source";
import { icons } from "lucide-react";
import { createElement } from "react";

// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  // it assigns a URL to your pages
  baseUrl: "/docs",
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }

    if (icon in icons) {
      return createElement(icons[icon as keyof typeof icons]);
    }

    // New logic for Tabler Icons
    // Helper function to convert kebab-case or simple lowercase to PascalCase
    const toPascalCase = (str: string) =>
      str
        .toLowerCase() // Ensure consistent starting point if mixed case like 'ArrowLeft' is passed
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");

    const tablerComponentName = `Icon${toPascalCase(icon)}`;

    if (tablerComponentName in TablerIcons) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: Dynamic icon lookup required for runtime icon resolution
      const IconComponent = TablerIcons[tablerComponentName as keyof typeof TablerIcons];
      // Check if it's a functional component or a forwardRef component
      if (
        typeof IconComponent === "function" ||
        (typeof IconComponent === "object" && IconComponent !== null && "render" in IconComponent)
      ) {
        return createElement(IconComponent as React.ComponentType<Record<string, never>>);
      }
    }
    // End of new logic for Tabler Icons

    console.error(`Icon ${icon} not found`);
  },
  source: docs.toFumadocsSource(),
});

type SourcePage = ReturnType<typeof source.getPages>[number];

export function getPageImage(page: SourcePage) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}
