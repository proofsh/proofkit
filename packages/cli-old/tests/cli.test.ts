import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("CLI Basic Tests", () => {
  it("should show help without throwing", () => {
    expect(() => {
      execSync("node ../dist/index.js --help", {
        cwd: import.meta.dirname,
        encoding: "utf-8",
      });
    }).not.toThrow();
  });

  it("should be executable", () => {
    expect(() => {
      execSync("node ../dist/index.js --version", {
        cwd: import.meta.dirname,
        encoding: "utf-8",
      });
    }).not.toThrow();
  });
});
