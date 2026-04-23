import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions}
      containerProps={{
        className: "[--fd-layout-width:100%]",
      }}
      sidebar={{
        footer: (
          <div className="mt-2 flex items-center justify-center text-muted-foreground text-xs">
            <p>
              Made with ❤️ by{" "}
              <a className="underline" href="http://proof.sh" rel="noopener" target="_blank">
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
