import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import fs from "fs-extra";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { makeLiveLayer } from "~/services/live.js";
import { getSharedTemplateDir, makeInitRequest } from "./init-fixtures.js";

const { execaMock, warnMock, successMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
  warnMock: vi.fn(),
  successMock: vi.fn(),
}));

vi.mock("execa", () => ({
  execa: execaMock,
}));

vi.mock("~/utils/prompts.js", () => ({
  confirmPrompt: vi.fn(),
  spinner: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    error: vi.fn(),
    info: vi.fn(),
    success: successMock,
    warn: warnMock,
  },
  multiSearchSelectPrompt: vi.fn(),
  note: vi.fn(),
  passwordPrompt: vi.fn(),
  searchSelectPrompt: vi.fn(),
  selectPrompt: vi.fn(),
  textPrompt: vi.fn(),
}));

describe("live git init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execaMock.mockImplementation((command: string, args: string[]) => {
      if (command === "pnpm" && args[0] === "-v") {
        return Promise.resolve({ stdout: "10.27.0" });
      }

      if (command === "git" && args[0] === "commit") {
        throw new Error("Author identity unknown");
      }

      return Promise.resolve({ stdout: "", stderr: "" });
    });
  });

  it("warns and continues when initial git commit fails", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-live-git-"));
    const plan = planInit(
      makeInitRequest({
        projectName: "git-warn-app",
        scopedAppName: "git-warn-app",
        appDir: "git-warn-app",
        appType: "browser",
        ui: "shadcn",
        dataSource: "none",
        packageManager: "pnpm",
        noInstall: true,
        noGit: false,
        force: false,
        cwd,
        importAlias: "~/",
        nonInteractive: true,
        debug: false,
        skipFileMakerSetup: false,
        hasExplicitFileMakerInputs: false,
      }),
      {
        templateDir: getSharedTemplateDir("nextjs-shadcn"),
      },
    );

    await expect(
      Effect.runPromise(executeInitPlan(plan).pipe(makeLiveLayer({ cwd, debug: false, nonInteractive: true }))),
    ).resolves.toBeDefined();

    expect(execaMock).toHaveBeenCalledWith("git", ["init"], expect.objectContaining({ cwd: plan.targetDir }));
    expect(execaMock).toHaveBeenCalledWith("git", ["add", "."], expect.objectContaining({ cwd: plan.targetDir }));
    expect(execaMock).toHaveBeenCalledWith(
      "git",
      ["commit", "-m", "Initial commit"],
      expect.objectContaining({ cwd: plan.targetDir }),
    );
    expect(warnMock).toHaveBeenCalledWith("Git initial commit failed; continuing without commit.");
    expect(successMock).toHaveBeenCalledWith(expect.stringContaining("Created git-warn-app"));
  });
});
