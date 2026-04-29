import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { NonInteractiveInputError } from "~/core/errors.js";
import { runDefaultCommand } from "~/index.js";
import { getFailure } from "./effect-test-utils.js";
import { makeTestLayer } from "./test-layer.js";

function createConsoleTranscript() {
  return {
    info: [] as string[],
    warn: [] as string[],
    error: [] as string[],
    success: [] as string[],
    note: [] as Array<{ message: string; title?: string }>,
  };
}

describe("default command routing", () => {
  it("routes to init when no ProofKit project is present", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-default-init-"));
    const consoleTranscript = createConsoleTranscript();

    await Effect.runPromise(
      runDefaultCommand().pipe(
        makeTestLayer({
          cwd,
          packageManager: "pnpm",
          nonInteractive: false,
          console: consoleTranscript,
          prompts: {
            text: ["routed-app"],
            select: ["browser", "none"],
          },
        }),
      ),
    );

    expect(await fs.pathExists(path.join(cwd, "routed-app", "proofkit.json"))).toBe(true);
    expect(consoleTranscript.success.at(-1) ?? "").toContain("Created routed-app");
    expect(consoleTranscript.note.some((entry) => entry.title === "Coming soon")).toBe(false);
  });

  it("shows the project menu when a ProofKit project is present in interactive mode", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-default-project-"));
    await fs.writeJson(path.join(cwd, "proofkit.json"), {
      appType: "browser",
      ui: "shadcn",
      dataSources: [],
      replacedMainPage: false,
      registryTemplates: [],
    });
    const consoleTranscript = createConsoleTranscript();
    const promptTranscript = {
      text: [],
      password: [],
      select: [],
      searchSelect: [],
      multiSearchSelect: [],
      confirm: [],
    };

    await Effect.runPromise(
      runDefaultCommand().pipe(
        makeTestLayer({
          cwd,
          packageManager: "pnpm",
          nonInteractive: false,
          console: consoleTranscript,
          prompts: {
            select: ["doctor"],
          },
          promptTranscript,
        }),
      ),
    );

    expect(promptTranscript.select).toEqual([
      {
        message: "What would you like to do?",
        options: ["add", "remove", "typegen", "deploy", "upgrade", "doctor", "prompt", "docs"],
      },
    ]);
    expect(consoleTranscript.note.some((entry) => entry.title === "Project commands")).toBe(false);
  });

  it("shows explicit project command guidance when a ProofKit project is present in non-interactive mode", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-default-project-ci-"));
    await fs.writeJson(path.join(cwd, "proofkit.json"), {
      appType: "browser",
      ui: "shadcn",
      dataSources: [],
      replacedMainPage: false,
      registryTemplates: [],
    });
    const consoleTranscript = createConsoleTranscript();

    await Effect.runPromise(
      runDefaultCommand({ nonInteractive: true }).pipe(
        makeTestLayer({
          cwd,
          packageManager: "pnpm",
          nonInteractive: true,
          console: consoleTranscript,
        }),
      ),
    );

    expect(consoleTranscript.note).toEqual([
      {
        title: "Project commands",
        message: expect.stringContaining("Use an explicit command such as `proofkit doctor`"),
      },
    ]);
  });

  it("fails in non-interactive mode without an explicit command", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-new-default-ci-"));

    expect(
      await getFailure(
        runDefaultCommand({ nonInteractive: true }).pipe(
          makeTestLayer({
            cwd,
            packageManager: "pnpm",
            nonInteractive: true,
          }),
        ),
      ),
    ).toMatchObject(
      new NonInteractiveInputError({
        message:
          "The default command is interactive-only in non-interactive mode. Run an explicit command such as `proofkit init <name> --non-interactive`.",
      }),
    );
  });
});
