import { type SourceFile, SyntaxKind } from "ts-morph";

import { ensureReturnStatementIsWrappedInFragment } from "~/utils/ts-morph.js";

export function addToHeaderSlot(slotSourceFile: SourceFile, importFrom: string) {
  slotSourceFile.addImportDeclaration({
    defaultImport: "UserMenu",
    moduleSpecifier: importFrom,
  });

  // ensure Group from @mantine/core is imported
  const mantineCoreImport = slotSourceFile.getImportDeclaration(
    (dec) => dec.getModuleSpecifierValue() === "@mantine/core",
  );
  if (mantineCoreImport) {
    const groupImport = mantineCoreImport.getNamedImports().find((imp) => imp.getName() === "Group");

    if (!groupImport) {
      mantineCoreImport.addNamedImport({ name: "Group" });
    }
  } else {
    slotSourceFile.addImportDeclaration({
      namedImports: [{ name: "Group" }],
      moduleSpecifier: "@mantine/core",
    });
  }

  const returnStatement = ensureReturnStatementIsWrappedInFragment(
    slotSourceFile
      .getFunction((dec) => dec.isDefaultExport())
      ?.getBody()
      ?.getFirstDescendantByKind(SyntaxKind.ReturnStatement),
  );

  const existingElements = returnStatement
    ?.getFirstDescendantByKind(SyntaxKind.JsxOpeningFragment)
    ?.getParentIfKind(SyntaxKind.JsxFragment)
    ?.getFirstDescendantByKind(SyntaxKind.SyntaxList)
    ?.getText();

  if (!existingElements) {
    console.log(`Failed to inject into header slot at ${slotSourceFile.getFilePath()}`);
    return;
  }

  returnStatement?.replaceWithText(`return (<><Group>${existingElements}<UserMenu /></Group></>)`);
  returnStatement?.formatText();
  slotSourceFile.saveSync();
}
