import { z } from "zod/v4";

const valueListsOptions = z.enum(["strict", "allowEmpty", "ignore"]);
export type ValueListsOptions = z.infer<typeof valueListsOptions>;

const layoutConfig = z.object({
  layoutName: z.string().meta({
    description: "The layout name from your FileMaker solution",
  }),
  schemaName: z.string().meta({
    description: "A friendly name for the generated layout-specific client",
  }),
  valueLists: valueListsOptions.optional().meta({
    description:
      "If set to 'strict', the value lists will be validated to ensure that the values are correct. If set to 'allowEmpty', the value lists will be validated to ensure that the values are correct, but empty value lists will be allowed. If set to 'ignore', the value lists will not be validated and typed as `string`.",
  }),
  generateClient: z.boolean().optional().meta({
    description: "If true, a layout-specific client will be generated (unless set to `false` at the top level)",
  }),
  strictNumbers: z.boolean().optional().meta({
    description:
      "If true, number fields will be typed as `number | null`. It's false by default because sometimes very large number will be returned as scientific notation via the Data API and therefore the type will be `number | string`.",
  }),
});

// Base schema without transforms for JSON Schema generation (used in API validation)
export const envNamesBase = z
  .object({
    server: z.string().optional(),
    db: z.string().optional(),
    auth: z
      .object({
        apiKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
    fmHttp: z
      .object({
        baseUrl: z.string().optional(),
        connectedFileName: z.string().optional(),
      })
      .optional(),
  })
  .optional()
  .meta({
    description:
      "If you're using other environment variables than the default, custom the NAMES of them here for the typegen to lookup their values when it runs.",
  });

// Runtime schema with transforms (used for actual typegen processing)
const envNames = envNamesBase
  .transform((val) => {
    if (!val) {
      return undefined;
    }

    // Transform empty strings to undefined
    const transformed: typeof val = {
      server: val.server === "" ? undefined : val.server,
      db: val.db === "" ? undefined : val.db,
      auth: val.auth
        ? {
            apiKey: val.auth.apiKey === "" ? undefined : val.auth.apiKey,
            username: val.auth.username === "" ? undefined : val.auth.username,
            password: val.auth.password === "" ? undefined : val.auth.password,
          }
        : undefined,
      fmHttp: val.fmHttp
        ? {
            baseUrl: val.fmHttp.baseUrl === "" ? undefined : val.fmHttp.baseUrl,
            connectedFileName: val.fmHttp.connectedFileName === "" ? undefined : val.fmHttp.connectedFileName,
          }
        : undefined,
    };

    // Remove auth if all values are undefined
    if (transformed.auth && Object.values(transformed.auth).every((v) => v === undefined)) {
      transformed.auth = undefined;
    }

    // Remove fmHttp if all values are undefined
    if (transformed.fmHttp && Object.values(transformed.fmHttp).every((v) => v === undefined)) {
      transformed.fmHttp = undefined;
    }

    // Return undefined if all top-level values are undefined
    if (Object.values(transformed).every((v) => v === undefined)) {
      return undefined;
    }

    return transformed;
  })
  .meta({
    description:
      "If you're using other environment variables than the default, custom the NAMES of them here for the typegen to lookup their values when it runs.",
  });

const path = z
  .string()
  .default("schema")
  .optional()
  .meta({ description: "The folder path to output the generated files" });

// Field-level override configuration
const fieldOverride = z.object({
  // Field name to apply override to
  fieldName: z.string().meta({
    description: "The field name this override applies to",
  }),
  // Exclude this field from generation
  exclude: z.boolean().optional().meta({
    description: "If true, this field will be excluded from generation",
  }),
  // Override the inferred type from metadata
  typeOverride: z
    .enum([
      "text", // textField()
      "number", // numberField()
      "boolean", // numberField().outputValidator(z.coerce.boolean())
      "date", // dateField()
      "timestamp", // timestampField()
      "container", // containerField()
      "list", // listField()
    ])
    .optional()
    .meta({
      description:
        "Override the inferred field type from metadata. Options: text, number, boolean, date, timestamp, container, list",
    }),
});

// Table-level configuration (opt-in model)
const tableConfig = z.object({
  // Table name to generate
  tableName: z.string().meta({
    description:
      "The entity set name (table occurrence name) to generate. This table will be included in metadata download and type generation.",
  }),
  // Override the generated TypeScript variable name
  // (original entity set name is still used for the path)
  variableName: z.string().optional().meta({
    description:
      "Override the generated TypeScript variable name. The original entity set name is still used for the OData path.",
  }),
  // Field-specific overrides as an array
  fields: z.array(fieldOverride).optional().meta({
    description: "Field-specific overrides as an array",
  }),
  reduceMetadata: z.boolean().optional().meta({
    description:
      "If undefined, the top-level setting will be used. If true, reduced OData annotations will be requested from the server to reduce payload size. This will prevent comments, entity ids, and other properties from being generated.",
  }),
  alwaysOverrideFieldNames: z.boolean().optional().meta({
    description:
      "If undefined, the top-level setting will be used. If true, field names will always be updated to match metadata, even when matching by entity ID. If false, existing field names are preserved when matching by entity ID.",
  }),
  includeAllFieldsByDefault: z.boolean().optional().meta({
    description:
      "If true, all fields will be included by default. If false, only fields that are explicitly listed in the `fields` array will be included.",
  }),
});

// Shared field definitions to avoid duplication
const clearOldFilesField = z.boolean().default(false).optional().meta({
  description:
    "If false, the path will not be cleared before the new files are written. Only the `client` and `generated` directories are cleared to allow for potential overrides to be kept.",
});

const validatorField = z
  .union([z.enum(["zod", "zod/v4", "zod/v3"]), z.literal(false)])
  .default("zod/v4")
  .optional()
  .meta({
    description:
      "If set to 'zod', 'zod/v4', or 'zod/v3', the validator will be generated using zod, otherwise it will generated Typescript types only and no runtime validation will be performed",
  });

const clientSuffixField = z.string().default("Layout").optional().meta({
  description: "The suffix to be added to the schema name for each layout",
});

const generateClientField = z.boolean().default(true).optional().meta({
  description:
    "If true, a layout-specific client will be generated for each layout provided, otherwise it will only generate the types. This option can be overridden for each layout individually.",
});

const webviewerScriptNameField = z.string().optional().meta({
  description:
    "The name of the webviewer script to be used. If this key is set, the generated client will use the @proofkit/webviewer adapter instead of the OttoFMS or Fetch adapter, which will only work when loaded inside of a FileMaker webviewer.",
});

const fmHttpField = z
  .object({
    scriptName: z.string().optional().meta({
      description:
        'The name of the FileMaker script that executes Data API calls. Defaults to "execute_data_api".',
    }),
  })
  .optional()
  .meta({
    description:
      "If set, the generated client will use the FmHttpAdapter to connect via a local FM HTTP server instead of OttoFMS or direct FileMaker Data API.",
  });

const reduceMetadataField = z.boolean().optional().meta({
  description:
    "If true, reduced OData annotations will be requested from the server to reduce payload size. This will prevent comments, entity ids, and other properties from being generated.",
});

const alwaysOverrideFieldNamesField = z.boolean().default(true).optional().meta({
  description:
    "If true (default), field names will always be updated to match metadata, even when matching by entity ID. If false, existing field names are preserved when matching by entity ID.",
});

const tablesField = z.array(tableConfig).default([]).meta({
  description:
    "Required array of tables to generate. Only the tables specified here will be downloaded and generated. Each table can have field-level overrides for excluding fields, renaming variables, and overriding field types.",
});

const includeAllFieldsByDefaultField = z.boolean().default(true).optional().meta({
  description:
    "If true, all fields will be included by default. If false, only fields that are explicitly listed in the `fields` array will be included.",
});

// Helper function to create config objects with different envNames schemas
const createFmdapiConfig = (envNamesSchema: typeof envNames | typeof envNamesBase) =>
  z.object({
    type: z.literal("fmdapi"),
    configName: z.string().optional(),
    envNames: envNamesSchema,
    layouts: z.array(layoutConfig).default([]),
    path,
    clearOldFiles: clearOldFilesField,
    validator: validatorField,
    clientSuffix: clientSuffixField,
    generateClient: generateClientField,
    webviewerScriptName: webviewerScriptNameField,
    fmHttp: fmHttpField,
  });

const createFmodataConfig = (envNamesSchema: typeof envNames | typeof envNamesBase) =>
  z.object({
    type: z.literal("fmodata"),
    configName: z.string().optional(),
    envNames: z.optional(envNamesSchema),
    path,
    reduceMetadata: reduceMetadataField,
    clearOldFiles: clearOldFilesField,
    alwaysOverrideFieldNames: alwaysOverrideFieldNamesField,
    tables: tablesField,
    includeAllFieldsByDefault: includeAllFieldsByDefaultField,
  });

// Runtime schema with transforms (used for actual typegen processing)
const typegenConfigSingleBase = z.discriminatedUnion("type", [
  createFmdapiConfig(envNames),
  createFmodataConfig(envNames),
]);

// Validation schema without transforms/preprocess for API routes (JSON Schema compatible)
// This schema is used in API validation where JSON Schema generation is needed
export const typegenConfigSingleForValidation = z.discriminatedUnion("type", [
  createFmdapiConfig(envNamesBase),
  createFmodataConfig(envNamesBase),
]);

// Add default "type" field for backwards compatibility
export const typegenConfigSingle = z.preprocess((data) => {
  if (data && typeof data === "object" && !("type" in data)) {
    return { ...data, type: "fmdapi" };
  }
  return data;
}, typegenConfigSingleBase);

export const typegenConfig = z.object({
  postGenerateCommand: z.string().optional().meta({
    description:
      "Optional CLI command to run after files are generated. Commonly used for formatting. Example: 'pnpm biome format --write .' or 'npx prettier --write src/'",
  }),
  config: z.union([z.array(typegenConfigSingle), typegenConfigSingle]),
});

// Validation version for JSON Schema generation (no transforms, no preprocess)
export const typegenConfigForValidation = z.object({
  postGenerateCommand: z.string().optional().meta({
    description:
      "Optional CLI command to run after files are generated. Commonly used for formatting. Example: 'pnpm biome format --write .' or 'npx prettier --write src/'",
  }),
  config: z.union([z.array(typegenConfigSingleForValidation), typegenConfigSingleForValidation]),
});

export type TypegenConfig = z.infer<typeof typegenConfig>;

export type FmodataConfig = Extract<z.infer<typeof typegenConfigSingle>, { type: "fmodata" }>;

export interface TSchema {
  name: string;
  type: "string" | "fmnumber" | "valueList";
  values?: string[];
}

export interface BuildSchemaArgs {
  schemaName: string;
  schema: TSchema[];
  type: "zod" | "zod/v4" | "zod/v3" | "ts";
  portalSchema?: { schemaName: string; schema: TSchema[] }[];
  valueLists?: { name: string; values: string[] }[];
  envNames: NonNullable<z.infer<typeof envNames>>;
  layoutName: string;
  strictNumbers?: boolean;
  webviewerScriptName?: string;
  fmHttp?: { scriptName?: string };
}
