import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { getSidebarTabs } from "fumadocs-ui/utils/get-sidebar-tabs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { getTemplatesByCategory } from "@/lib/templates";
import { baseOptions } from "../../layout.config";
import { categoryConfigs } from "./category-config";

async function buildTemplatesTree() {
  const templatesByCategory = await getTemplatesByCategory();

  const children: PageTree.Root["children"] = [
    {
      name: "Overview",
      url: "/docs/templates",
      type: "page",
    },
  ];

  // Add each category as a separator followed by its templates in the defined order
  for (const { category, name } of categoryConfigs) {
    const templates = templatesByCategory[category];
    if (!templates || templates.length === 0) {
      continue;
    }

    // Add category separator
    children.push({
      name,
      type: "separator",
    });

    // Add all templates in this category
    for (const template of templates) {
      children.push({
        name: template.title,
        url: `/docs${template.path}`,
        type: "page",
      });
    }
  }

  return {
    children,
  };
}

export default async function Layout({ children }: { children: ReactNode }) {
  const templatesTree = await buildTemplatesTree();

  // Find the existing Templates folder in the source tree
  const _templatesFolder = source.pageTree.children.find(
    (child) => child.type === "folder" && child.name === "Templates",
  );

  // Create a new tree with the Templates folder replaced
  const newChildren = source.pageTree.children.map((child) => {
    if (child.type === "folder" && child.name === "Templates") {
      // Replace the Templates folder with our custom one that includes dynamic templates
      return {
        ...child, // Preserve the original properties (including icon, root, etc.)
        children: templatesTree.children,
      };
    }
    return child;
  });

  const newTree: PageTree.Root = {
    ...source.pageTree,
    children: newChildren,
  };

  const tabs = getSidebarTabs(newTree);

  return (
    <DocsLayout
      tree={newTree}
      {...baseOptions}
      containerProps={{
        className: "[--fd-layout-width:100%]",
      }}
      sidebar={{
        tabs,
        footer: (
          <div className="mt-2 flex items-center justify-center text-muted-foreground text-xs">
            <p>
              Made with ❤️ by{" "}
              <a className="underline" href="http://proof.sh" rel="noopener noreferrer" target="_blank">
                Proof
              </a>
            </p>
          </div>
        ),
      }}
    >
      <div className="p-8">{children}</div>
    </DocsLayout>
  );
}
