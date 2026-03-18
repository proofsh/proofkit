import {
  intro as clackIntro,
  isCancel as clackIsCancel,
  log as clackLog,
  note as clackNote,
  outro as clackOutro,
  spinner as clackSpinner,
} from "@clack/prompts";
import {
  checkbox as inquirerCheckbox,
  confirm as inquirerConfirm,
  input as inquirerInput,
  password as inquirerPassword,
  search as inquirerSearch,
  select as inquirerSelect,
} from "@inquirer/prompts";

const CANCEL_SYMBOL = Symbol.for("@proofkit/new/prompt-cancelled");

export const intro = clackIntro;
export const log = clackLog;
export const note = clackNote;
export const outro = clackOutro;
export const spinner = clackSpinner;

function isPromptCancel(error: unknown) {
  return error instanceof Error && error.name === "ExitPromptError";
}

function withCancelSentinel<T>(fn: () => Promise<T>): Promise<T | symbol> {
  return fn().catch((error: unknown) => {
    if (isPromptCancel(error)) {
      return CANCEL_SYMBOL;
    }
    throw error;
  });
}

export function isCancel(value: unknown): value is symbol {
  return value === CANCEL_SYMBOL || clackIsCancel(value);
}

export interface PromptOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean | string;
}

export interface SearchPromptOption<T extends string> extends PromptOption<T> {
  keywords?: readonly string[];
}

function normalizeValidate(
  validate: ((value: string) => string | undefined) | undefined,
): ((value: string) => string | boolean) | undefined {
  if (!validate) {
    return undefined;
  }

  return (value: string) => validate(value) ?? true;
}

function matchesSearch(option: SearchPromptOption<string>, query: string) {
  const haystack = [option.label, option.hint ?? "", ...(option.keywords ?? [])].join(" ").toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function normalizeDisabledMessage(value: boolean | string | undefined) {
  if (typeof value === "string") {
    return value;
  }
  return value ? true : undefined;
}

export function filterSearchOptions<T extends string>(
  options: readonly SearchPromptOption<T>[],
  query: string | undefined,
) {
  const term = query?.trim();
  if (!term) {
    return options;
  }

  return options.filter((option) => matchesSearch(option, term));
}

export function textPrompt(options: {
  message: string;
  defaultValue?: string;
  validate?: (value: string) => string | undefined;
}) {
  return withCancelSentinel(() =>
    inquirerInput({
      message: options.message,
      default: options.defaultValue,
      validate: normalizeValidate(options.validate),
    }),
  );
}

export function passwordPrompt(options: { message: string; validate?: (value: string) => string | undefined }) {
  return withCancelSentinel(() =>
    inquirerPassword({
      message: options.message,
      validate: normalizeValidate(options.validate),
    }),
  );
}

export function confirmPrompt(options: { message: string; initialValue?: boolean }) {
  return withCancelSentinel(() =>
    inquirerConfirm({
      message: options.message,
      default: options.initialValue,
    }),
  );
}

export function selectPrompt<T extends string>(options: { message: string; options: PromptOption<T>[] }) {
  return withCancelSentinel(() =>
    inquirerSelect<T>({
      message: options.message,
      pageSize: 10,
      choices: options.options.map((option) => ({
        value: option.value,
        name: option.label,
        description: option.hint,
        disabled: normalizeDisabledMessage(option.disabled),
      })),
    }),
  );
}

export function searchSelectPrompt<T extends string>(options: {
  message: string;
  emptyMessage?: string;
  options: SearchPromptOption<T>[];
}) {
  return withCancelSentinel(() =>
    inquirerSearch<T>({
      message: options.message,
      pageSize: 10,
      source: (input) => {
        const filtered = filterSearchOptions(options.options, input);
        if (filtered.length === 0) {
          return [
            {
              value: "__no_matches__" as T,
              name: options.emptyMessage ?? "No matches found. Keep typing to refine your search.",
              disabled: options.emptyMessage ?? "No matches found",
            },
          ];
        }

        return filtered.map((option) => ({
          value: option.value,
          name: option.label,
          description: option.hint,
          disabled: normalizeDisabledMessage(option.disabled),
        }));
      },
    }),
  );
}

export function multiSearchSelectPrompt<T extends string>(options: {
  message: string;
  options: SearchPromptOption<T>[];
  required?: boolean;
}) {
  return withCancelSentinel(() =>
    inquirerCheckbox<T>({
      message: options.message,
      pageSize: 10,
      required: options.required,
      choices: options.options.map((option) => ({
        value: option.value,
        name: option.label,
        description: option.hint,
        disabled: normalizeDisabledMessage(option.disabled),
      })),
    }),
  );
}
