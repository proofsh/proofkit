import { describe, expect, it, vi } from "vitest";

import { createPostInitGenerationError, isMissingTypegenCommandError } from "~/cli/init";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  search: vi.fn(),
  select: vi.fn(),
}));

describe("init post-init generation error handling", () => {
  it("detects missing typegen command failures", () => {
    const commandError = new Error(
      'Command failed with exit code 254: pnpm typegen\nERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "typegen" not found',
    );

    expect(isMissingTypegenCommandError(commandError)).toBe(true);
  });

  it("does not classify broad pnpm typegen execution failures as missing command", () => {
    const commandError = new Error(
      "Command failed with exit code 1: pnpm typegen\nError: connect ECONNREFUSED 127.0.0.1:3000",
    );

    expect(isMissingTypegenCommandError(commandError)).toBe(false);
  });

  it("creates browser-specific guidance for missing typegen command failures", () => {
    const commandError = new Error(
      'Command failed with exit code 254: pnpm typegen\nERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "typegen" not found',
    );

    const userFacingError = createPostInitGenerationError({
      error: commandError,
      appType: "browser",
      projectDir: "/tmp/demo-browser",
    });

    expect(userFacingError.message).toContain("Post-init generation failed after scaffolding.");
    expect(userFacingError.message).toContain("Project created at: /tmp/demo-browser");
    expect(userFacingError.message).toContain("browser scaffolds do not define that script");
    expect(userFacingError.message).toContain("proofkit typegen");
  });

  it("creates generic recovery guidance for other generation failures", () => {
    const commandError = new Error("Unable to read layout metadata");

    const userFacingError = createPostInitGenerationError({
      error: commandError,
      appType: "webviewer",
      projectDir: "/tmp/demo-webviewer",
    });

    expect(userFacingError.message).toContain("Post-init generation failed after scaffolding.");
    expect(userFacingError.message).toContain("Project created at: /tmp/demo-webviewer");
    expect(userFacingError.message).toContain("Retry `proofkit typegen`");
    expect(userFacingError.message).toContain("Underlying error: Unable to read layout metadata");
  });
});
