import type { Node, Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { BrainCircuit, Leaf } from "lucide-react";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

const llmSidebarNodes: Node[] = [
  {
    type: "separator",
    name: "For LLMs",
  },
  {
    type: "page",
    name: "llms.txt",
    url: "/llms.txt",
    external: true,
    icon: <Leaf />,
  },
  {
    type: "page",
    name: "llms-full.txt",
    url: "/llms-full.txt",
    external: true,
    icon: <BrainCircuit />,
  },
];

const docsTree = appendLlmLinks(source.pageTree);

function appendLlmLinks(tree: Root): Root {
  return {
    ...tree,
    children: [...tree.children.map(appendLlmLinksToNode), ...llmSidebarNodes],
  };
}

function appendLlmLinksToNode(node: Node): Node {
  if (node.type !== "folder") {
    return node;
  }

  const children = node.children.map(appendLlmLinksToNode);

  return {
    ...node,
    children: node.root ? [...children, ...llmSidebarNodes] : children,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={docsTree}
      {...baseOptions}
      containerProps={{
        className: "[--fd-layout-width:100%]",
      }}
      sidebar={{
        footer: (
          <div className="mt-2 flex items-center justify-center text-muted-foreground text-xs">
            <p>
              Made with ❤️ by{" "}
              <a className="underline" href="https://proof.sh" rel="noopener" target="_blank">
                Proof
              </a>
            </p>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
