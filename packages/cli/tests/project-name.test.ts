import { afterEach, describe, expect, it, vi } from "vitest";
import { parseNameAndPath, validateAppName } from "~/utils/projectName.js";

describe("projectName utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes Windows-style separators when parsing the app name and directory", () => {
    expect(parseNameAndPath("apps\\my-app")).toEqual(["my-app", "apps/my-app"]);
    expect(parseNameAndPath(".\\my-app\\")).toEqual(["my-app", "./my-app"]);
  });

  it("validates the actual current directory name when projectName is '.'", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/tmp/My App");
    expect(validateAppName(".")).toBe("Name must consist of only lowercase alphanumeric characters, '-', and '_'");
  });

  it("accepts '.' when the current directory name is valid", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/tmp/my-app");
    expect(validateAppName(".")).toBeUndefined();
  });
});
