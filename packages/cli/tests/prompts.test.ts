import { describe, expect, it } from "vitest";
import { filterSearchOptions } from "~/utils/prompts.js";

describe("filterSearchOptions", () => {
  const options = [
    {
      value: "Contacts.fmp12",
      label: "Contacts.fmp12",
      hint: "open",
      keywords: ["contacts", "reporting"],
    },
    {
      value: "Invoices.fmp12",
      label: "Invoices.fmp12",
      hint: "closed",
      keywords: ["billing"],
      disabled: "Already connected",
    },
  ] as const;

  it("matches on labels, hints, and keywords", () => {
    expect(filterSearchOptions(options, "reporting").map((option) => option.value)).toEqual(["Contacts.fmp12"]);
    expect(filterSearchOptions(options, "closed").map((option) => option.value)).toEqual(["Invoices.fmp12"]);
  });

  it("returns all options when the search term is empty", () => {
    expect(filterSearchOptions(options, "")).toEqual(options);
    expect(filterSearchOptions(options, "   ")).toEqual(options);
    expect(filterSearchOptions(options, undefined)).toEqual(options);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterSearchOptions(options, "missing")).toEqual([]);
  });
});
