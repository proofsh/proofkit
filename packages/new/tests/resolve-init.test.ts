import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { resolveInitRequest } from "~/core/resolveInitRequest.js";
import { makeTestLayer } from "./test-layer.js";

describe("resolveInitRequest", () => {
  it("fails for missing project name in non-interactive mode", async () => {
    await expect(
      Effect.runPromise(
        resolveInitRequest(undefined, {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: true,
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
          }),
        ),
      ),
    ).rejects.toThrow("Project name is required in non-interactive mode.");
  });

  it("fails for incomplete non-interactive filemaker inputs", async () => {
    await expect(
      Effect.runPromise(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: true,
          appType: "browser",
          dataSource: "filemaker",
          server: "https://example.com",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
          }),
        ),
      ),
    ).rejects.toThrow("Missing required FileMaker inputs");
  });
});
