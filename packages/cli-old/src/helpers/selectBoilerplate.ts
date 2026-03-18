import path from "node:path";
import fs from "fs-extra";

import { PKG_ROOT } from "~/consts.js";
import type { InstallerOptions } from "~/installers/index.js";
import { state } from "~/state.js";

type SelectBoilerplateProps = Required<Pick<InstallerOptions, "packages">>;

export const selectLayoutFile = (_props: SelectBoilerplateProps) => {
  const projectDir = state.projectDir;
  const layoutFileDir = path.join(PKG_ROOT, "template/extras/src/app/layout");

  const layoutFile = "base.tsx";

  const appSrc = path.join(layoutFileDir, layoutFile); // base layout
  const appDest = path.join(projectDir, "src/app/layout.tsx");
  fs.copySync(appSrc, appDest);

  fs.copySync(path.join(layoutFileDir, "main-shell.tsx"), path.join(projectDir, "src/app/(main)/layout.tsx"));
};

export const selectPageFile = (_props: SelectBoilerplateProps) => {
  const projectDir = state.projectDir;
  const indexFileDir = path.join(PKG_ROOT, "template/extras/src/app/page");

  const indexFile = "base.tsx";

  const indexSrc = path.join(indexFileDir, indexFile);
  const indexDest = path.join(projectDir, "src/app/(main)/page.tsx");
  fs.copySync(indexSrc, indexDest);
};
