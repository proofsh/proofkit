import { type CodeBlockWriter, type SourceFile, VariableDeclarationKind } from "ts-morph";
import { defaultEnvNames } from "./constants";
import type { BuildSchemaArgs } from "./types";

const defaultWebviewerScriptName = "execute_data_api";

function getGeneratedWebviewerScriptName(args: Pick<BuildSchemaArgs, "webviewerScriptName" | "fmHttp">) {
  if (args.webviewerScriptName) {
    return args.webviewerScriptName;
  }
  if (args.fmHttp) {
    return args.fmHttp.scriptName ?? defaultWebviewerScriptName;
  }
  return undefined;
}

export function buildLayoutClient(sourceFile: SourceFile, args: BuildSchemaArgs) {
  const { schemaName, portalSchema, envNames, type, webviewerScriptName, fmHttp, layoutName } = args;
  const generatedWebviewerScriptName = getGeneratedWebviewerScriptName({ webviewerScriptName, fmHttp });
  const usesWebviewerAdapter = generatedWebviewerScriptName !== undefined;

  const fmdapiImport = sourceFile.addImportDeclaration({
    moduleSpecifier: "@proofkit/fmdapi",
    namedImports: ["DataApi"],
  });
  const hasPortals = (portalSchema ?? []).length > 0;
  if (usesWebviewerAdapter) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "@proofkit/webviewer/adapter",
      namedImports: ["WebViewerAdapter"],
    });
  } else if (typeof envNames.auth === "object" && "apiKey" in envNames.auth && envNames.auth.apiKey !== undefined) {
    // if otto, add the OttoAdapter and OttoAPIKey imports
    fmdapiImport.addNamedImports([{ name: "OttoAdapter" }, { name: "OttoAPIKey", isTypeOnly: true }]);
  } else {
    fmdapiImport.addNamedImport({ name: "FetchAdapter" });
  }

  // import the types
  if (type === "zod" || type === "zod/v4" || type === "zod/v3") {
    const schemaImport = sourceFile.addImportDeclaration({
      moduleSpecifier: `../${schemaName}`,
      namedImports: [{ name: `Z${schemaName}` }],
    });

    // add portal imports
    if (hasPortals) {
      schemaImport.addNamedImport(`Z${schemaName}Portals`);
    }
  } else if (type === "ts") {
    const schemaImport = sourceFile.addImportDeclaration({
      moduleSpecifier: `../${schemaName}`,
      namedImports: [{ name: `T${schemaName}` }],
    });

    // add portal imports
    if (hasPortals) {
      schemaImport.addNamedImport(`T${schemaName}Portals`);
    }
  }

  if (!usesWebviewerAdapter) {
    addTypeGuardStatements(sourceFile, {
      envVarName: envNames.db ?? defaultEnvNames.db,
    });
    addTypeGuardStatements(sourceFile, {
      envVarName: envNames.server ?? defaultEnvNames.server,
    });
    if (typeof envNames.auth === "object") {
      if (envNames.auth.apiKey !== undefined) {
        addTypeGuardStatements(sourceFile, {
          envVarName: envNames.auth.apiKey,
        });
      } else if (envNames.auth.username !== undefined && envNames.auth.password !== undefined) {
        addTypeGuardStatements(sourceFile, {
          envVarName: envNames.auth.username,
        });
        addTypeGuardStatements(sourceFile, {
          envVarName: envNames.auth.password,
        });
      }
    }
  }

  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    declarations: [
      {
        name: "client",
        initializer: (writer) => {
          let dataApiType: string;
          if (type === "ts") {
            dataApiType = hasPortals ? `DataApi<T${schemaName}, T${schemaName}Portals>(` : `DataApi<T${schemaName}>(`;
          } else {
            dataApiType = "DataApi(";
          }
          writer
            .write(dataApiType)
            .inlineBlock(() => {
              writer.write("adapter: ");
              buildAdapter(writer, args);
              writer.write(",").newLine();
              writer.write("layout: ").quote(layoutName).write(",").newLine();
              if (type === "zod" || type === "zod/v4" || type === "zod/v3") {
                writer.writeLine(
                  `schema: { fieldData: Z${schemaName}${hasPortals ? `, portalData: Z${schemaName}Portals` : ""} },`,
                );
              }
            })
            .write(")");
        },
      },
    ],
  });

  //   sourceFile.addExportAssignment({ isExportEquals: true, expression: "" });
}

function addTypeGuardStatements(sourceFile: SourceFile, { envVarName }: { envVarName: string }) {
  sourceFile.addStatements((writer) => {
    writer.writeLine(`if (!process.env.${envVarName}) throw new Error("Missing env var: ${envVarName}")`);
  });
}

function buildAdapter(writer: CodeBlockWriter, args: BuildSchemaArgs): string {
  const { envNames } = args;
  const generatedWebviewerScriptName = getGeneratedWebviewerScriptName(args);

  if (generatedWebviewerScriptName) {
    writer.write("new WebViewerAdapter({scriptName: ");
    writer.quote(generatedWebviewerScriptName);
    writer.write("})");
  } else if (typeof envNames.auth === "object" && "apiKey" in envNames.auth && envNames.auth.apiKey !== undefined) {
    writer
      .write("new OttoAdapter(")
      .inlineBlock(() => {
        if (typeof envNames.auth !== "object" || !("apiKey" in envNames.auth) || envNames.auth.apiKey === undefined) {
          return;
        }
        writer.write(`auth: { apiKey: process.env.${envNames.auth.apiKey} as OttoAPIKey }`).write(",").newLine();
        writer.write(`db: process.env.${envNames.db}`).write(",").newLine();
        writer.write(`server: process.env.${envNames.server}`).write(",").newLine();
      })
      .write(")");
  } else {
    writer
      .write("new FetchAdapter(")
      .inlineBlock(() => {
        if (
          typeof envNames.auth !== "object" ||
          !("username" in envNames.auth) ||
          envNames.auth.username === undefined
        ) {
          return;
        }
        writer
          .writeLine("auth:")
          .inlineBlock(() => {
            if (
              typeof envNames.auth !== "object" ||
              !("username" in envNames.auth) ||
              envNames.auth.username === undefined
            ) {
              return;
            }
            writer.write(`username: process.env.${envNames.auth.username}`).write(",").newLine();
            writer.write(`password: process.env.${envNames.auth.password}`);
          })
          .write(",")
          .writeLine(`db: process.env.${envNames.db},`)
          .writeLine(`server: process.env.${envNames.server}`);
      })
      .write(")");
  }

  return writer.toString();
}
