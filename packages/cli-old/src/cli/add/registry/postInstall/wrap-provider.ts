import path from "node:path";
import type { PostInstallStep } from "@proofkit/registry";
import { type ImportDeclarationStructure, type JsxChild, type JsxElement, StructureKind, SyntaxKind } from "ts-morph";

import { getShadcnConfig } from "~/helpers/shadcn-cli.js";
import { state } from "~/state.js";
import { logger } from "~/utils/logger.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";

export async function wrapProvider(step: Extract<PostInstallStep, { action: "wrap provider" }>) {
  const { parentTag, imports: importConfigs, providerCloseTag, providerOpenTag } = step.data;

  try {
    const projectDir = state.projectDir;
    const project = getNewProject(projectDir);
    const shadcnConfig = getShadcnConfig();

    // Resolve the components alias to a filesystem path
    // @/components -> src/components, ./components -> components, etc.
    const resolveAlias = (alias: string): string => {
      if (alias.startsWith("@/")) {
        return alias.replace("@/", "src/");
      }
      if (alias.startsWith("./")) {
        return alias.substring(2);
      }
      return alias;
    };

    // Look for providers.tsx in the components directory
    const componentsDir = resolveAlias(shadcnConfig.aliases.components);
    const providersPath = path.join(projectDir, componentsDir, "providers.tsx");

    const providersFile = project.addSourceFileAtPath(providersPath);

    // Add all import statements
    for (const importConfig of importConfigs) {
      const importDeclaration: ImportDeclarationStructure = {
        moduleSpecifier: importConfig.moduleSpecifier,
        kind: StructureKind.ImportDeclaration,
      };

      if (importConfig.defaultImport) {
        importDeclaration.defaultImport = importConfig.defaultImport;
      }

      if (importConfig.namedImports && importConfig.namedImports.length > 0) {
        importDeclaration.namedImports = importConfig.namedImports;
      }

      providersFile.addImportDeclaration(importDeclaration);
    }

    // Handle providers.tsx file - look for the default export function
    const exportDefault = providersFile.getFunction((dec) => dec.isDefaultExport());

    if (!exportDefault) {
      logger.warn(`No default export function found in ${providersPath}`);
      return;
    }

    const returnStatement = exportDefault?.getBody()?.getFirstDescendantByKind(SyntaxKind.ReturnStatement);

    if (!returnStatement) {
      logger.warn("No return statement found in default export function");
      return;
    }

    let targetElement: JsxElement | undefined;

    // Try to find the parent tag if specified
    if (parentTag && parentTag.length > 0) {
      for (const tag of parentTag) {
        targetElement = returnStatement
          ?.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
          .find((openingElement) => openingElement.getTagNameNode().getText() === tag)
          ?.getParentIfKind(SyntaxKind.JsxElement);

        if (targetElement) {
          break;
        }
      }
    }

    if (targetElement) {
      // If we found a parent tag, wrap its children
      const childrenText = targetElement
        ?.getJsxChildren()
        .map((child: JsxChild) => child.getText())
        .filter(Boolean)
        .join("\n");

      const newContent = `${providerOpenTag}
      ${childrenText}
    ${providerCloseTag}`;

      targetElement.getChildSyntaxList()?.replaceWithText(newContent);
    } else {
      // If no parent tag found or specified, wrap the entire return statement
      const returnExpression = returnStatement?.getExpression();
      if (returnExpression) {
        // Check if the expression is a ParenthesizedExpression
        const isParenthesized = returnExpression.getKind() === SyntaxKind.ParenthesizedExpression;

        let innerExpressionText: string;
        if (isParenthesized) {
          // Get the inner expression from the parenthesized expression
          const parenthesizedExpr = returnExpression.asKindOrThrow(SyntaxKind.ParenthesizedExpression);
          innerExpressionText = parenthesizedExpr.getExpression().getText();
        } else {
          innerExpressionText = returnExpression.getText();
        }

        const newReturnContent = `return (
    ${providerOpenTag}
      ${innerExpressionText}
    ${providerCloseTag}
  );`;

        returnStatement?.replaceWithText(newReturnContent);
      } else {
        logger.warn("No return expression found to wrap");
      }
    }

    await formatAndSaveSourceFiles(project);
    logger.success(`Successfully wrapped provider in ${providersPath}`);
  } catch (error) {
    logger.error(`Failed to wrap provider: ${error}`);
    throw error;
  }
}
