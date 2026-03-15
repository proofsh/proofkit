// Barrel file - exports all public API from the client folder
/** biome-ignore-all lint/performance/noBarrelFile: Re-exporting all public API from the client folder */

export type { FFetchOptions } from "@fetchkit/ffetch";
// Re-export ffetch errors and types
export {
  AbortError,
  CircuitOpenError,
  NetworkError,
  RetryLimitError,
  TimeoutError,
} from "@fetchkit/ffetch";

// Type-only exports - for type annotations only, not direct instantiation
export type { Database } from "./client/database";
export type { EntitySet } from "./client/entity-set";
// Main API - use these functions to create tables and occurrences
export { FMServerConnection } from "./client/filemaker-odata";
export type {
  ContainerField,
  DateField,
  Field,
  NumericField,
  SchemaManager,
  StringField,
  TimeField,
  TimestampField,
} from "./client/schema-manager";
export type {
  Webhook,
  WebhookAddResponse,
  WebhookInfo,
  WebhookListResponse,
} from "./client/webhook-builder";
export type { FMODataErrorType } from "./errors";
// Export our errors
export {
  BatchTruncatedError,
  FMODataError,
  HTTPError,
  isBatchTruncatedError,
  isFMODataError,
  isHTTPError,
  isODataError,
  isRecordCountMismatchError,
  isResponseParseError,
  isResponseStructureError,
  isSchemaLockedError,
  isTransientError,
  isValidationError,
  ODataError,
  RecordCountMismatchError,
  ResponseParseError,
  ResponseStructureError,
  SchemaLockedError,
  ValidationError,
} from "./errors";
export type { Logger } from "./logger";
// NEW ORM API - Drizzle-inspired field builders and operators
export {
  and,
  asc,
  // Column references
  type Column,
  type ColumnFunction,
  calcField,
  containerField,
  contains,
  dateField,
  desc,
  endsWith,
  eq,
  type FieldBuilder,
  // Filter operators
  type FilterExpression,
  FMTable,
  type FMTableWithColumns as TableOccurrenceResult,
  // Table definition
  fmTableOccurrence,
  // Table helper functions
  // getTableFields,
  // getDefaultSelect,
  // getBaseTableConfig,
  // getFieldId,
  // getFieldName,
  // getTableId,
  getTableColumns,
  gt,
  gte,
  type InferTableSchema,
  inArray,
  isColumn,
  isColumnFunction,
  isNotNull,
  isNull,
  type ListFieldOptions,
  listField,
  lt,
  lte,
  matchesPattern,
  ne,
  not,
  notInArray,
  numberField,
  // OrderBy operators
  type OrderByExpression,
  or,
  startsWith,
  // Field builders
  textField,
  timeField,
  timestampField,
  tolower,
  toupper,
  trim,
} from "./orm/index";
// Utility types for type annotations
export type {
  BatchItemResult,
  BatchResult,
  ExecuteMethodOptions,
  ExecuteOptions,
  FetchHandler,
  InferSchemaType,
  Metadata,
  ODataRecordMetadata,
  Result,
  RetryPolicy,
} from "./types";
