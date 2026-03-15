import type { Column } from "../../orm/column";

/**
 * Type-safe orderBy type that provides better DX than odata-query's default.
 *
 * Supported forms:
 * - `keyof T` - single field name (defaults to ascending)
 * - `[keyof T, 'asc' | 'desc']` - single field with explicit direction
 * - `Array<[keyof T, 'asc' | 'desc']>` - multiple fields with directions
 *
 * This type intentionally EXCLUDES `Array<keyof T>` to avoid ambiguity
 * between [field1, field2] and [field, direction].
 */
export type TypeSafeOrderBy<T> =
  | (keyof T & string) // Single field name
  | [keyof T & string, "asc" | "desc"] // Single field with direction
  | [keyof T & string, "asc" | "desc"][]; // Multiple fields with directions

// Internal type for expand configuration
export type { ExpandConfig } from "../builders/shared-types";

// Type to represent expanded relations
// biome-ignore lint/suspicious/noExplicitAny: Dynamic schema and selected types from user input
export type ExpandedRelations = Record<string, { schema: any; selected: any; nested?: ExpandedRelations }>;

/**
 * Extract the value type from a Column.
 * This uses the phantom type stored in Column to get the actual value type (output type for reading).
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for type inference with infer
type ExtractColumnType<C> = C extends Column<infer T, any, any, any> ? T : never;

/**
 * Map a select object to its return type.
 * For each key in the select object, extract the type from the corresponding Column.
 */
type MapSelectToReturnType<
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  TSelect extends Record<string, Column<any, any, any, any>>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any schema shape
  _TSchema extends Record<string, any>,
> = {
  [K in keyof TSelect]: ExtractColumnType<TSelect[K]>;
};

/**
 * Helper: Resolve a single expand's return type, including nested expands
 */
// biome-ignore lint/suspicious/noExplicitAny: Dynamic schema and selected types from user input
export type ResolveExpandType<Exp extends { schema: any; selected: any; nested?: ExpandedRelations }> = // Handle the selected fields
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  (Exp["selected"] extends Record<string, Column<any, any, any, any>>
    ? MapSelectToReturnType<Exp["selected"], Exp["schema"]>
    : Exp["selected"] extends keyof Exp["schema"]
      ? Pick<Exp["schema"], Exp["selected"]>
      : Exp["schema"]) &
    // Recursively handle nested expands
    // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no nested expands
    (Exp["nested"] extends ExpandedRelations ? ResolveExpandedRelations<Exp["nested"]> : {});

/**
 * Helper: Resolve all expanded relations recursively
 */
export type ResolveExpandedRelations<Exps extends ExpandedRelations> = {
  [K in keyof Exps]: ResolveExpandType<Exps[K]>[];
};

/**
 * System columns option for select() method.
 * Allows explicitly requesting ROWID and/or ROWMODID when using select().
 */
export interface SystemColumnsOption {
  ROWID?: boolean;
  ROWMODID?: boolean;
}

/**
 * Extract system columns type from SystemColumnsOption.
 * Returns an object type with ROWID and/or ROWMODID properties when set to true.
 */
export type SystemColumnsFromOption<T extends SystemColumnsOption | undefined> = (T extends { ROWID: true }
  ? { ROWID: number }
  : // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no ROWID field
    {}) &
  // biome-ignore lint/complexity/noBannedTypes: Empty object type represents no ROWMODID field
  (T extends { ROWMODID: true } ? { ROWMODID: number } : {});

export type QueryReturnType<
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any schema shape
  T extends Record<string, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  Selected extends keyof T | Record<string, Column<any, any, any, any>>,
  SingleMode extends "exact" | "maybe" | false,
  IsCount extends boolean,
  Expands extends ExpandedRelations,
  SystemCols extends SystemColumnsOption | undefined = undefined,
> = IsCount extends true
  ? number
  : // Use tuple wrapping [Selected] extends [...] to prevent distribution over unions
    // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
    [Selected] extends [Record<string, Column<any, any, any, any>>]
    ? SingleMode extends "exact"
      ? MapSelectToReturnType<Selected, T> & ResolveExpandedRelations<Expands> & SystemColumnsFromOption<SystemCols>
      : SingleMode extends "maybe"
        ?
            | (MapSelectToReturnType<Selected, T> &
                ResolveExpandedRelations<Expands> &
                SystemColumnsFromOption<SystemCols>)
            | null
        : (MapSelectToReturnType<Selected, T> &
            ResolveExpandedRelations<Expands> &
            SystemColumnsFromOption<SystemCols>)[]
    : // Use tuple wrapping to prevent distribution over union of keys
      [Selected] extends [keyof T]
      ? SingleMode extends "exact"
        ? Pick<T, Selected> & ResolveExpandedRelations<Expands> & SystemColumnsFromOption<SystemCols>
        : SingleMode extends "maybe"
          ? (Pick<T, Selected> & ResolveExpandedRelations<Expands> & SystemColumnsFromOption<SystemCols>) | null
          : (Pick<T, Selected> & ResolveExpandedRelations<Expands> & SystemColumnsFromOption<SystemCols>)[]
      : never;
