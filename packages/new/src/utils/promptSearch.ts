interface SearchOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  keywords?: string[];
}

interface PromptFns<T extends string> {
  promptForSearch: (message: string) => Promise<string>;
  promptForSelect: (message: string, options: { value: T; label: string; hint?: string }[]) => Promise<T>;
}

const SEARCH_SENTINEL = "__search__";

function matchesSearch<T extends string>(option: SearchOption<T>, query: string) {
  const haystack = [option.label, option.hint ?? "", ...(option.keywords ?? [])].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function promptSearchSelect<T extends string>(
  fns: PromptFns<T | typeof SEARCH_SENTINEL>,
  options: {
    message: string;
    searchLabel?: string;
    emptyMessage?: string;
    options: SearchOption<T>[];
  },
) {
  let query = "";

  while (true) {
    const filtered = query ? options.options.filter((option) => matchesSearch(option, query)) : options.options;
    const labelSuffix = query ? ` (search: ${query})` : "";

    if (filtered.length === 0) {
      query = await fns.promptForSearch(options.emptyMessage ?? "No matches. Enter a new search term");
      continue;
    }

    const selection = await fns.promptForSelect(`${options.message}${labelSuffix}`, [
      ...filtered.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
      })),
      {
        value: SEARCH_SENTINEL,
        label: query ? "Change search" : (options.searchLabel ?? "Search"),
        hint: query ? `Current: ${query}` : "Filter the list",
      },
    ]);

    if (selection !== SEARCH_SENTINEL) {
      return selection;
    }

    query = await fns.promptForSearch(options.searchLabel ?? "Enter search text");
  }
}
