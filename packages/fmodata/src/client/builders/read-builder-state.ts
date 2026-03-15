import type { QueryOptions } from "odata-query";
import type { SystemColumnsOption } from "../query/types";
import type { NavigationConfig } from "../query/url-builder";
import type { ExpandConfig } from "./shared-types";

export interface QueryReadBuilderState<TSchema> {
  queryOptions: Partial<QueryOptions<TSchema>>;
  expandConfigs: ExpandConfig[];
  singleMode: "exact" | "maybe" | false;
  isCountMode: boolean;
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
  };
}

export function cloneQueryReadBuilderState<TSchema>(
  state: QueryReadBuilderState<TSchema>,
  changes?: Partial<QueryReadBuilderState<TSchema>> & {
    queryOptions?: Partial<QueryOptions<TSchema>>;
  },
): QueryReadBuilderState<TSchema> {
  return {
    ...state,
    ...changes,
    queryOptions: {
      ...state.queryOptions,
      ...(changes?.queryOptions ?? {}),
    },
    expandConfigs: changes?.expandConfigs ? [...changes.expandConfigs] : [...state.expandConfigs],
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
    selectedFields = changes?.selectedFields;
  }

  let fieldMapping = state.fieldMapping ? { ...state.fieldMapping } : undefined;
  if ("fieldMapping" in (changes ?? {})) {
    fieldMapping = changes?.fieldMapping;
  }

  return {
    ...state,
    ...changes,
    selectedFields,
    expandConfigs: changes?.expandConfigs ? [...changes.expandConfigs] : [...state.expandConfigs],
    fieldMapping,
  };
}
