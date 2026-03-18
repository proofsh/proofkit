import path from "node:path";
import fs from "fs-extra";
import { type Project, SyntaxKind } from "ts-morph";

import { PKG_ROOT } from "~/consts.js";
import { state } from "~/state.js";
import { addPackageDependency } from "~/utils/addPackageDependency.js";
import { getSettings, setSettings } from "~/utils/parseSettings.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";

export async function injectTanstackQuery(args?: { project?: Project }) {
  const projectDir = state.projectDir;
  const settings = getSettings();
  if (settings.ui === "shadcn") {
    return false;
  }
  if (settings.tanstackQuery) {
    return false;
  }

  addPackageDependency({
    projectDir,
    dependencies: ["@tanstack/react-query"],
    devMode: false,
  });
  addPackageDependency({
    projectDir,
    dependencies: ["@tanstack/react-query-devtools"],
    devMode: true,
  });
  const extrasDir = path.join(PKG_ROOT, "template", "extras");

  if (state.appType === "browser") {
    fs.copySync(
      path.join(extrasDir, "config", "get-query-client.ts"),
      path.join(projectDir, "src/config/get-query-client.ts"),
    );
    fs.copySync(
      path.join(extrasDir, "config", "query-provider.tsx"),
      path.join(projectDir, "src/config/query-provider.tsx"),
    );
  } else if (state.appType === "webviewer") {
    fs.copySync(
      path.join(extrasDir, "config", "query-provider-vite.tsx"),
      path.join(projectDir, "src/config/query-provider.tsx"),
    );
  }

  // inject query provider into the root layout
  const project = args?.project ?? getNewProject(projectDir);
  const rootLayout = project.addSourceFileAtPath(
    path.join(projectDir, state.appType === "browser" ? "src/app/layout.tsx" : "src/main.tsx"),
  );
  rootLayout.addImportDeclaration({
    moduleSpecifier: "@/config/query-provider",
    defaultImport: "QueryProvider",
  });

  if (state.appType === "browser") {
    const exportDefault = rootLayout.getFunction((dec) => dec.isDefaultExport());
    const bodyElement = exportDefault
      ?.getBody()
      ?.getFirstDescendantByKind(SyntaxKind.ReturnStatement)
      ?.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
      .find((openingElement) => openingElement.getTagNameNode().getText() === "body")
      ?.getParentIfKind(SyntaxKind.JsxElement);

    const childrenText = bodyElement
      ?.getJsxChildren()
      .map((child) => child.getText())
      .filter(Boolean)
      .join("\n");

    bodyElement?.getChildSyntaxList()?.replaceWithText(
      `<QueryProvider>
      ${childrenText}
    </QueryProvider>`,
    );
  } else if (state.appType === "webviewer") {
    const mantineProvider = rootLayout
      .getDescendantsOfKind(SyntaxKind.JsxElement)
      .find((element) => element.getOpeningElement().getTagNameNode().getText() === "MantineProvider");

    mantineProvider?.replaceWithText(
      `<QueryProvider>
      ${mantineProvider.getText()}
    </QueryProvider>`,
    );
  }

  if (!args?.project) {
    await formatAndSaveSourceFiles(project);
  }

  setSettings({ ...settings, tanstackQuery: true });
  return true;
}
