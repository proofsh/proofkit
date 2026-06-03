import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { runDoctor } from "~/core/doctor.js";
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

describe("doctor command", () => {
  it("reports missing proofkit project", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-doctor-missing-"));
    const consoleTranscript = createConsoleTranscript();

    await Effect.runPromise(
      runDoctor.pipe(
        makeTestLayer({
          cwd,
          packageManager: "pnpm",
          console: consoleTranscript,
        }),
      ),
    );

    expect(consoleTranscript.note[0]?.title).toBe("Doctor");
    expect(consoleTranscript.note[0]?.message).toContain("No ProofKit project found");
    expect(consoleTranscript.note[0]?.message).toContain("proofkit init");
  });

  it("reports missing typegen config and package-native next steps", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "proofkit-doctor-project-"));
    const consoleTranscript = createConsoleTranscript();

    await fs.writeJson(path.join(cwd, "proofkit.json"), {
      appType: "browser",
      ui: "shadcn",
      dataSources: [],
      replacedMainPage: false,
      registryTemplates: [],
    });
    await fs.writeJson(path.join(cwd, "package.json"), {
      name: "doctor-test",
      scripts: {
        typegen: "npx @proofkit/typegen",
      },
      devDependencies: {
        "@proofkit/typegen": "workspace:*",
      },
    });

    await Effect.runPromise(
      runDoctor.pipe(
        makeTestLayer({
          cwd,
          packageManager: "pnpm",
          console: consoleTranscript,
        }),
      ),
    );

    expect(consoleTranscript.note[0]?.title).toBe("Doctor");
    expect(consoleTranscript.note[0]?.message).toContain("Missing `proofkit-typegen.config.jsonc`");
    expect(consoleTranscript.note[0]?.message).toContain("npx @proofkit/typegen init");
    expect(consoleTranscript.note[0]?.message).toContain("npx @proofkit/typegen ui");
  });
});
