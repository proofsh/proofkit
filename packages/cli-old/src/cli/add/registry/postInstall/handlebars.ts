import path from "node:path";
import { decodeHandlebarsFromShadcn, type TemplateFile } from "@proofkit/registry";
import fs from "fs-extra";
import handlebars from "handlebars";
import { getClientSuffix, getFieldNamesForSchema } from "~/generators/fmdapi.js";
import { getShadcnConfig } from "~/helpers/shadcn-cli.js";
import { state } from "~/state.js";
import { type DataSource, getSettings } from "~/utils/parseSettings.js";

// Register handlebars helpers
handlebars.registerHelper("eq", (a, b) => a === b);

interface HandlebarsContext {
  [key: string]: unknown;
}

handlebars.registerHelper("findFirst", function (this: HandlebarsContext, array, predicate, options) {
  if (!(array && Array.isArray(array))) {
    return options.inverse(this);
  }

  for (const item of array) {
    if (predicate === "fm" && item.type === "fm") {
      return options.fn(item);
    }
  }
  return options.inverse(this);
});

interface DataSourceForTemplate {
  dataSource: DataSource;
  schemaName: string;
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

function buildDataSourceData(args: DataSourceForTemplate) {
  const { dataSource, schemaName } = args;

  const clientSuffix = getClientSuffix({
    projectDir: state.projectDir ?? process.cwd(),
    dataSourceName: dataSource.name,
  });

  const allFieldNames = getFieldNamesForSchema({
    schemaName,
    dataSourceName: dataSource.name,
  }).filter(Boolean) as string[];

  return {
    sourceName: dataSource.name,
    schemaName,
    clientSuffix,
    allFieldNames,
    fieldNames: filterOutCommonFieldNames(allFieldNames),
  };
}

export function buildHandlebarsData(args?: DataSourceForTemplate) {
  const proofkit = getSettings();
  const shadcn = getShadcnConfig();

  return {
    proofkit,
    shadcn,
    schema: args
      ? buildDataSourceData(args)
      : {
          sourceName: "UnknownDataSource",
          schemaName: "UnknownSchema",
          clientSuffix: "UnknownClientSuffix",
          allFieldNames: ["UnknownFieldName"],
          fieldNames: ["UnknownFieldName"],
        },
  };
}

export async function randerHandlebarsToFile(file: TemplateFile, data: ReturnType<typeof buildHandlebarsData>) {
  const inputPath = getFilePath(file, data);
  let rawTemplate = await fs.readFile(inputPath, "utf8");

  // Decode placeholder tokens back to handlebars syntax
  // This uses the centralized decoding function from the registry package
  rawTemplate = decodeHandlebarsFromShadcn(rawTemplate);

  const template = handlebars.compile(rawTemplate);
  const rendered = template(data);
  await fs.writeFile(inputPath, rendered);
}

export function getFilePath(file: TemplateFile, data: ReturnType<typeof buildHandlebarsData>): string {
  const thePath = file.sourceFileName;

  if (file.destinationPath) {
    return file.destinationPath;
  }

  const cwd = state.projectDir ?? process.cwd();
  const { shadcn } = data;

  // Create a mapping between registry types and their corresponding shadcn config aliases
  let blockAlias = "src/components/blocks";
  if (shadcn?.aliases?.components) {
    if (shadcn.aliases.components.startsWith("@/")) {
      blockAlias = `${shadcn.aliases.components.replace("@/", "src/")}/blocks`;
    } else {
      blockAlias = `src/${shadcn.aliases.components}/blocks`;
    }
  }

  const typeToAliasMap: Record<string, string | undefined> = {
    "registry:lib": shadcn?.aliases?.lib || shadcn?.aliases?.utils,
    "registry:component": shadcn?.aliases?.components,
    "registry:ui": shadcn?.aliases?.ui || shadcn?.aliases?.components,
    "registry:hook": shadcn?.aliases?.hooks,
    // These types don't have direct aliases, so we use fallback paths
    "registry:file": "src",
    "registry:page": "src/app",
    "registry:block": blockAlias,
    "registry:theme": "src/theme",
    "registry:style": "src/styles",
  };

  const aliasPath = typeToAliasMap[file.type];

  if (aliasPath) {
    // Handle @/ prefix which represents the src directory
    if (aliasPath.startsWith("@/")) {
      const resolvedPath = aliasPath.replace("@/", "src/");
      return path.join(cwd, resolvedPath, thePath);
    }
    // If the alias starts with a path separator or contains src/, treat it as a relative path from cwd
    if (aliasPath.startsWith("/") || aliasPath.includes("src/")) {
      return path.join(cwd, aliasPath, thePath);
    }
    // Otherwise, treat it as an alias that should be resolved relative to src/

    return path.join(cwd, "src", aliasPath, thePath);
  }

  // Fallback to hardcoded paths for unsupported types
  switch (file.type) {
    case "registry:lib":
      return path.join(cwd, "src", "lib", thePath);
    case "registry:file":
      return path.join(cwd, "src", thePath);
    case "registry:page": {
      // For page templates, use the route name if available in template data
      const routeName = "routeName" in data ? (data.routeName as string) : undefined;
      if (routeName) {
        // Add /(main) prefix for Next.js app router structure
        const pageRoute = routeName === "/" ? "" : routeName;
        return path.join(cwd, "src", "app", "(main)", pageRoute, thePath);
      }
      return path.join(cwd, "src", "app", thePath);
    }
    case "registry:block":
      return path.join(cwd, "src", "components", "blocks", thePath);
    case "registry:component":
      return path.join(cwd, "src", "components", thePath);
    case "registry:ui":
      return path.join(cwd, "src", "components", thePath);
    case "registry:hook":
      return path.join(cwd, "src", "hooks", thePath);
    case "registry:theme":
      return path.join(cwd, "src", "theme", thePath);
    case "registry:style":
      return path.join(cwd, "src", "styles", thePath);
    default:
      // default to source file name
      return thePath;
  }
}
