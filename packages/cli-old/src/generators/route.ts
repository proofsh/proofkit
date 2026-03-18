import path from "node:path";
import fs from "fs-extra";
import type { RouteLink } from "index.js";
import { SyntaxKind } from "ts-morph";

import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";

export async function addRouteToNav({
  projectDir,
  navType,
  ...route
}: Omit<RouteLink, "type"> & {
  projectDir: string;
  navType: "primary" | "secondary";
}) {
  const navFilePath = path.join(projectDir, "src/app/navigation.tsx");

  // If the navigation file doesn't exist (e.g., WebViewer apps), skip adding to nav
  if (!fs.existsSync(navFilePath)) {
    return;
  }

  const project = getNewProject(projectDir);
  const sourceFile = project.addSourceFileAtPath(navFilePath);
  sourceFile
    .getVariableDeclaration(navType === "primary" ? "primaryRoutes" : "secondaryRoutes")
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
    ?.addElement((writer) =>
      writer
        .block(() => {
          writer.write(`
          label: "${route.label}",
          type: "link",
          href: "${route.href}",`);
        })
        .write(","),
    );

  await formatAndSaveSourceFiles(project);
}
