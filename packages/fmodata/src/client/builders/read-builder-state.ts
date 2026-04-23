import type { QueryOptions } from "odata-query";
import type { FilterExpression } from "../../orm/operators";
import type { SystemColumnsOption } from "../query/types";
import type { NavigationConfig } from "../query/url-builder";
import type { ExpandConfig } from "./shared-types";

export interface QueryReadBuilderState<TSchema> {
  queryOptions: Partial<QueryOptions<TSchema>>;
  filterExpression?: FilterExpression;
  expandConfigs: ExpandConfig[];
  singleMode: "exact" | "maybe" | false;
  isCountMode: boolean;
  includeCountMode: boolean;
  fieldMapping?: Record<string, string>;
  systemColumns?: SystemColumnsOption;
  navigation?: NavigationConfig;
}

export function createInitialQueryReadBuilderState<TSchema>(): QueryReadBuilderState<TSchema> {
  return {
    queryOptions: {},
    expandConfigs: [],
    singleMode: false,
    isCountMode: false,
    includeCountMode: false,
  };
}

export function cloneQueryReadBuilderState<TSchema>(
  state: QueryReadBuilderState<TSchema>,
  changes?: Partial<QueryReadBuilderState<TSchema>> & {
    queryOptions?: Partial<QueryOptions<TSchema>>;
  },
): QueryReadBuilderState<TSchema> {
  let fieldMapping = state.fieldMapping ? { ...state.fieldMapping } : undefined;
  if ("fieldMapping" in (changes ?? {})) {
    fieldMapping = changes?.fieldMapping ? { ...changes.fieldMapping } : undefined;
  }

  return {
    ...state,
    ...changes,
    queryOptions: {
      ...state.queryOptions,
      ...(changes?.queryOptions ?? {}),
    },
    expandConfigs: changes?.expandConfigs ? [...changes.expandConfigs] : [...state.expandConfigs],
    fieldMapping,
  };
}

export interface RecordReadBuilderState {
  selectedFields?: string[];
  expandConfigs: ExpandConfig[];
  fieldMapping?: Record<string, string>;
  systemColumns?: SystemColumnsOption;
}

export function createInitialRecordReadBuilderState(): RecordReadBuilderState {
  return {
    expandConfigs: [],
  };
}

export function cloneRecordReadBuilderState(
  state: RecordReadBuilderState,
  changes?: Partial<RecordReadBuilderState>,
): RecordReadBuilderState {
  let selectedFields = state.selectedFields ? [...state.selectedFields] : undefined;
  if ("selectedFields" in (changes ?? {})) {
    selectedFields = changes?.selectedFields ? [...changes.selectedFields] : undefined;
  }

  let fieldMapping = state.fieldMapping ? { ...state.fieldMapping } : undefined;
  if ("fieldMapping" in (changes ?? {})) {
    fieldMapping = changes?.fieldMapping ? { ...changes.fieldMapping } : undefined;
  }

  return {
    ...state,
    ...changes,
    selectedFields,
    expandConfigs: changes?.expandConfigs ? [...changes.expandConfigs] : [...state.expandConfigs],
    fieldMapping,
  };
}
