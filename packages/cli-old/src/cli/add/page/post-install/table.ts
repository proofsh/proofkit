import path from "node:path";
import fs from "fs-extra";
import { SyntaxKind } from "ts-morph";

import { getClientSuffix, getFieldNamesForSchema } from "~/generators/fmdapi.js";
import { injectTanstackQuery } from "~/generators/tanstack-query.js";
import { installDependencies } from "~/helpers/installDependencies.js";
import { state } from "~/state.js";
import { getSettings } from "~/utils/parseSettings.js";
import { formatAndSaveSourceFiles, getNewProject } from "~/utils/ts-morph.js";
import type { TPostInstallFn } from "../types.js";

// Regex to validate JavaScript identifiers
const VALID_JS_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export const postInstallTable: TPostInstallFn = async ({ projectDir, pageDir, dataSource, schemaName }) => {
  if (!dataSource) {
    throw new Error("DataSource is required for table page");
  }
  if (!schemaName) {
    throw new Error("SchemaName is required for table page");
  }
  if (dataSource.type !== "fm") {
    throw new Error("FileMaker DataSource is required for table page");
  }

  const clientSuffix = getClientSuffix({
    projectDir,
    dataSourceName: dataSource.name,
  });

  const allFieldNames = getFieldNamesForSchema({
    schemaName,
    dataSourceName: dataSource.name,
  });

  const settings = getSettings();
  if (settings.ui === "shadcn") {
    return;
  }
  const auth = settings.auth;

  const substitutions = {
    __SOURCE_NAME__: dataSource.name,
    __TYPE_NAME__: `T${schemaName}`,
    __ZOD_TYPE_NAME__: `Z${schemaName}`,
    __CLIENT_NAME__: `${schemaName}${clientSuffix}`,
    __SCHEMA_NAME__: schemaName,
    __ACTION_CLIENT__: auth.type === "none" ? "actionClient" : "authedActionClient",
    __FIRST_FIELD_NAME__: allFieldNames[0] ?? "NO_FIELDS_ON_YOUR_LAYOUT",
  };

  // read all files in pageDir and loop over them
  const files = await fs.readdir(pageDir);
  for await (const file of files) {
    const filePath = path.join(pageDir, file);
    let fileContent = await fs.readFile(filePath, "utf8");

    for (const [key, value] of Object.entries(substitutions)) {
      fileContent = fileContent.replace(new RegExp(key, "g"), value);
    }

    await fs.writeFile(filePath, fileContent, "utf8");
  }

  // add the schemas to the columns array
  const project = getNewProject(projectDir);
  const sourceFile = project.addSourceFileAtPath(
    path.join(pageDir, state.appType === "browser" ? "table.tsx" : "index.tsx"),
  );
  const columns = sourceFile.getVariableDeclaration("columns")?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);

  const fieldNames = filterOutCommonFieldNames(allFieldNames.filter(Boolean) as string[]);

  for await (const fieldName of fieldNames) {
    columns?.addElement((writer) =>
      writer
        .inlineBlock(() => {
          if (needsBracketNotation(fieldName)) {
            writer.write(`accessorFn: (row) => row["${fieldName}"],`);
          } else {
            writer.write(`accessorFn: (row) => row.${fieldName},`);
          }
          writer.write(`header: "${fieldName}",`);
        })
        .write(",")
        .newLine(),
    );
  }

  if (state.appType === "webviewer") {
    const didInject = await injectTanstackQuery({ project });
    if (didInject) {
      await installDependencies();
    }
  }

  await formatAndSaveSourceFiles(project);
};

// Function to check if a field name needs bracket notation
function needsBracketNotation(fieldName: string): boolean {
  // Check if it's a valid JavaScript identifier
  return !VALID_JS_IDENTIFIER.test(fieldName);
}

const commonFieldNamesToExclude = [
  "id",
  "pk",
  "createdat",
  "updatedat",
  "primarykey",
  "createdby",
  "modifiedby",
  "creationtimestamp",
  "modificationtimestamp",
];

function filterOutCommonFieldNames(fieldNames: string[]): string[] {
  return fieldNames.filter(
    (fieldName) => !commonFieldNamesToExclude.includes(fieldName.toLowerCase()) || fieldName.startsWith("_"),
  );
}
