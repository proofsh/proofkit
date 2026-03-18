import path from "node:path";
import { Command } from "commander";
import fs from "fs-extra";
import { Node, type Project, type PropertyAssignment, SyntaxKind } from "ts-morph";
import * as p from "~/cli/prompts.js";

import { ciOption, debugOption } from "~/globalOptions.js";
import { initProgramState, state } from "~/state.js";
import { getSettings } from "~/utils/parseSettings.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";
import { abortIfCancel, ensureProofKitProject } from "../utils.js";

const getExistingRoutes = (project: Project): { label: string; href: string }[] => {
  const navFilePath = path.join(state.projectDir, "src/app/navigation.tsx");

  // If navigation file doesn't exist (e.g., webviewer apps), there are no nav routes to remove
  if (!fs.existsSync(navFilePath)) {
    return [];
  }

  const sourceFile = project.addSourceFileAtPath(navFilePath);

  const routes: { label: string; href: string }[] = [];

  // Get primary routes
  const primaryRoutes = sourceFile
    .getVariableDeclaration("primaryRoutes")
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
    ?.getElements();

  if (primaryRoutes) {
    for (const element of primaryRoutes) {
      if (Node.isObjectLiteralExpression(element)) {
        const labelProp = element
          .getProperties()
          .find((prop): prop is PropertyAssignment => Node.isPropertyAssignment(prop) && prop.getName() === "label");
        const hrefProp = element
          .getProperties()
          .find((prop): prop is PropertyAssignment => Node.isPropertyAssignment(prop) && prop.getName() === "href");

        const label = labelProp?.getInitializer()?.getText().replace(/['"]/g, "");
        const href = hrefProp?.getInitializer()?.getText().replace(/['"]/g, "");

        if (label && href) {
          routes.push({ label, href });
        }
      }
    }
  }

  // Get secondary routes
  const secondaryRoutes = sourceFile
    .getVariableDeclaration("secondaryRoutes")
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
    ?.getElements();

  if (secondaryRoutes) {
    for (const element of secondaryRoutes) {
      if (Node.isObjectLiteralExpression(element)) {
        const labelProp = element
          .getProperties()
          .find((prop): prop is PropertyAssignment => Node.isPropertyAssignment(prop) && prop.getName() === "label");
        const hrefProp = element
          .getProperties()
          .find((prop): prop is PropertyAssignment => Node.isPropertyAssignment(prop) && prop.getName() === "href");

        const label = labelProp?.getInitializer()?.getText().replace(/['"]/g, "");
        const href = hrefProp?.getInitializer()?.getText().replace(/['"]/g, "");

        if (label && href) {
          routes.push({ label, href });
        }
      }
    }
  }

  return routes;
};

const removeRouteFromNav = async (project: Project, routeToRemove: string) => {
  const navFilePath = path.join(state.projectDir, "src/app/navigation.tsx");

  // Skip if there is no navigation file
  if (!fs.existsSync(navFilePath)) {
    return;
  }

  const sourceFile = project.addSourceFileAtPath(navFilePath);

  // Remove from primary routes
  const primaryRoutes = sourceFile
    .getVariableDeclaration("primaryRoutes")
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);

  if (primaryRoutes) {
    const elements = primaryRoutes.getElements();
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (Node.isObjectLiteralExpression(element)) {
        const hrefProp = element
          .getProperties()
          .find((prop): prop is PropertyAssignment => Node.isPropertyAssignment(prop) && prop.getName() === "href");

        const href = hrefProp?.getInitializer()?.getText().replace(/['"]/g, "");

        if (href === routeToRemove) {
          primaryRoutes.removeElement(i);
        }
      }
    }
  }

  // Remove from secondary routes
  const secondaryRoutes = sourceFile
    .getVariableDeclaration("secondaryRoutes")
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);

  if (secondaryRoutes) {
    const elements = secondaryRoutes.getElements();
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (Node.isObjectLiteralExpression(element)) {
        const hrefProp = element
          .getProperties()
          .find((prop): prop is PropertyAssignment => Node.isPropertyAssignment(prop) && prop.getName() === "href");

        const href = hrefProp?.getInitializer()?.getText().replace(/['"]/g, "");

        if (href === routeToRemove) {
          secondaryRoutes.removeElement(i);
        }
      }
    }
  }

  await formatAndSaveSourceFiles(project);
};

export const runRemovePageAction = async (routeName?: string) => {
  const _settings = getSettings();
  const projectDir = state.projectDir;
  const project = getNewProject(projectDir);

  // Get existing routes
  const routes = getExistingRoutes(project);

  if (routes.length === 0) {
    return p.cancel("No pages found in the navigation.");
  }

  let selectedRouteName = routeName;
  if (!selectedRouteName) {
    selectedRouteName = abortIfCancel(
      await p.select({
        message: "Select the page to remove",
        options: routes.map((route) => ({
          label: `${route.label} (${route.href})`,
          value: route.href,
        })),
      }),
    );
  }

  if (!selectedRouteName.startsWith("/")) {
    selectedRouteName = `/${selectedRouteName}`;
  }

  const pagePath =
    state.appType === "browser"
      ? path.join(projectDir, "src/app/(main)", selectedRouteName)
      : path.join(projectDir, "src/routes", selectedRouteName);

  const spinner = p.spinner();
  spinner.start("Removing page");

  try {
    // Check if directory exists
    if (!fs.existsSync(pagePath)) {
      spinner.stop("Page not found!");
      return p.cancel(`Page at ${selectedRouteName} does not exist`);
    }

    // Remove from navigation first (if present)
    await removeRouteFromNav(project, selectedRouteName);

    // Remove the page directory
    await fs.remove(pagePath);

    spinner.stop("Page removed successfully!");
  } catch (error) {
    spinner.stop("Failed to remove page!");
    console.error("Error removing page:", error);
    process.exit(1);
  }
};

export const makeRemovePageCommand = () => {
  const removePageCommand = new Command("page")
    .description("Remove a page from your project")
    .argument("[route]", "The route of the page to remove")
    .addOption(ciOption)
    .addOption(debugOption)
    .action(async (route: string) => {
      await runRemovePageAction(route);
    });

  removePageCommand.hook("preAction", (_thisCommand, actionCommand) => {
    initProgramState(actionCommand.opts());
    state.baseCommand = "remove";
    ensureProofKitProject({ commandName: "remove" });
  });

  return removePageCommand;
};
