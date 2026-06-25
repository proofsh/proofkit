import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfigPath } from "../src/cli";

let originalCwd: string;
let tempDir: string;

describe("typegen cli config lookup", () => {
  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "proofkit-typegen-config-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it.each(["proofkit.config.jsonc", "proofkit.config.json"])("finds %s fallback files", (configPath) => {
    fs.writeFileSync(configPath, "{}", "utf8");

    expect(getConfigPath()).toBe(configPath);
  });

  it.each(["adt.config.jsonc", "adt.config.json"])("finds %s fallback files", (configPath) => {
    fs.writeFileSync(configPath, "{}", "utf8");

    expect(getConfigPath()).toBe(configPath);
  });

  it("prefers existing proofkit typegen configs", () => {
    fs.writeFileSync("proofkit-typegen.config.json", "{}", "utf8");
    fs.writeFileSync("proofkit.config.jsonc", "{}", "utf8");

    expect(getConfigPath()).toBe("proofkit-typegen.config.json");
  });

  it("prefers jsonc before json for the same config name", () => {
    fs.writeFileSync("proofkit.config.jsonc", "{}", "utf8");
    fs.writeFileSync("proofkit.config.json", "{}", "utf8");

    expect(getConfigPath()).toBe("proofkit.config.jsonc");
  });
});
