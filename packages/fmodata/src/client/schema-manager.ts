import type { FFetchOptions } from "@fetchkit/ffetch";
import { Effect } from "effect";
import { requestFromService, runLayerOrThrow } from "../effect";
import type { FMODataLayer, ODataConfig } from "../services";
import { createClientRuntime } from "./runtime";

interface GenericField {
  name: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  global?: boolean;
  repetitions?: number;
}

type StringField = GenericField & {
  type: "string";
  maxLength?: number;
  default?: "USER" | "USERNAME" | "CURRENT_USER";
};

type NumericField = GenericField & {
  type: "numeric";
};

type DateField = GenericField & {
  type: "date";
  default?: "CURRENT_DATE" | "CURDATE";
};

type TimeField = GenericField & {
  type: "time";
  default?: "CURRENT_TIME" | "CURTIME";
};

type TimestampField = GenericField & {
  type: "timestamp";
  default?: "CURRENT_TIMESTAMP" | "CURTIMESTAMP";
};

type ContainerField = GenericField & {
  type: "container";
  externalSecurePath?: string;
};

export type Field = StringField | NumericField | DateField | TimeField | TimestampField | ContainerField;

export type { StringField, NumericField, DateField, TimeField, TimestampField, ContainerField };

type FileMakerField = Omit<Field, "type" | "repetitions" | "maxLength"> & {
  type: string;
};

interface TableDefinition {
  tableName: string;
  fields: FileMakerField[];
}

export class SchemaManager {
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(layer: FMODataLayer) {
    const runtime = createClientRuntime(layer);
    this.layer = runtime.layer;
    this.config = runtime.config;
  }

  createTable(tableName: string, fields: Field[], options?: RequestInit & FFetchOptions): Promise<TableDefinition> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<TableDefinition>(`/${this.config.databaseName}/FileMaker_Tables`, {
        method: "POST",
        body: JSON.stringify({
          tableName,
          fields: fields.map(SchemaManager.compileFieldDefinition),
        }),
        ...options,
      });
    });

    return runLayerOrThrow(this.layer, pipeline, "fmodata.schema.createTable");
  }

  addFields(tableName: string, fields: Field[], options?: RequestInit & FFetchOptions): Promise<TableDefinition> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<TableDefinition>(`/${this.config.databaseName}/FileMaker_Tables/${tableName}`, {
        method: "PATCH",
        body: JSON.stringify({
          fields: fields.map(SchemaManager.compileFieldDefinition),
        }),
        ...options,
      });
    });

    return runLayerOrThrow(this.layer, pipeline, "fmodata.schema.addFields");
  }

  async deleteTable(tableName: string, options?: RequestInit & FFetchOptions): Promise<void> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService(`/${this.config.databaseName}/FileMaker_Tables/${tableName}`, {
        method: "DELETE",
        ...options,
      });
    });

    await runLayerOrThrow(this.layer, pipeline, "fmodata.schema.deleteTable");
  }

  async deleteField(tableName: string, fieldName: string, options?: RequestInit & FFetchOptions): Promise<void> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService(`/${this.config.databaseName}/FileMaker_Tables/${tableName}/${fieldName}`, {
        method: "DELETE",
        ...options,
      });
    });

    await runLayerOrThrow(this.layer, pipeline, "fmodata.schema.deleteField");
  }

  createIndex(
    tableName: string,
    fieldName: string,
    options?: RequestInit & FFetchOptions,
  ): Promise<{ indexName: string }> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<{ indexName: string }>(
        `/${this.config.databaseName}/FileMaker_Indexes/${tableName}`,
        {
          method: "POST",
          body: JSON.stringify({ indexName: fieldName }),
          ...options,
        },
      );
    });

    return runLayerOrThrow(this.layer, pipeline, "fmodata.schema.createIndex");
  }

  async deleteIndex(tableName: string, fieldName: string, options?: RequestInit & FFetchOptions): Promise<void> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService(`/${this.config.databaseName}/FileMaker_Indexes/${tableName}/${fieldName}`, {
        method: "DELETE",
        ...options,
      });
    });

    await runLayerOrThrow(this.layer, pipeline, "fmodata.schema.deleteIndex");
  }

  private static compileFieldDefinition(field: Field): FileMakerField {
    let type: string = field.type;
    const repetitions = field.repetitions;

    // Handle string fields - convert to varchar and add maxLength if present
    if (field.type === "string") {
      type = "varchar";
      const stringField = field as StringField;
      if (stringField.maxLength !== undefined) {
        type += `(${stringField.maxLength})`;
      }
    }

    // Add repetitions suffix if present
    if (repetitions !== undefined) {
      type += `[${repetitions}]`;
    }

    // Build the result object, excluding type, maxLength, and repetitions
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic result object construction
    const result: any = {
      name: field.name,
      type,
    };

    // Add optional properties that FileMaker expects
    if (field.nullable !== undefined) {
      result.nullable = field.nullable;
    }
    if (field.primary !== undefined) {
      result.primary = field.primary;
    }
    if (field.unique !== undefined) {
      result.unique = field.unique;
    }
    if (field.global !== undefined) {
      result.global = field.global;
    }

    // Add type-specific properties
    if (field.type === "string") {
      const stringField = field as StringField;
      if (stringField.default !== undefined) {
        result.default = stringField.default;
      }
    } else if (field.type === "date") {
      const dateField = field as DateField;
      if (dateField.default !== undefined) {
        result.default = dateField.default;
      }
    } else if (field.type === "time") {
      const timeField = field as TimeField;
      if (timeField.default !== undefined) {
        result.default = timeField.default;
      }
    } else if (field.type === "timestamp") {
      const timestampField = field as TimestampField;
      if (timestampField.default !== undefined) {
        result.default = timestampField.default;
      }
    } else if (field.type === "container") {
      const containerField = field as ContainerField;
      if (containerField.externalSecurePath !== undefined) {
        result.externalSecurePath = containerField.externalSecurePath;
      }
    }

    return result as FileMakerField;
  }
}
