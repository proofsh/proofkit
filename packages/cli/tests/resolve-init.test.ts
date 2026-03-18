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
    ).rejects.toThrow("--file-name, --data-api-key");
  });

  it("fails when only one of layout-name and schema-name is provided", async () => {
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
          layoutName: "API_Contacts",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
          }),
        ),
      ),
    ).rejects.toThrow("Both --layout-name and --schema-name must be provided together.");
  });

  it("resolves an interactive filemaker request from prompt responses", async () => {
    const request = await Effect.runPromise(
      resolveInitRequest(undefined, {
        noGit: true,
        noInstall: true,
        force: false,
        default: false,
        importAlias: "~/",
        CI: false,
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "pnpm",
          nonInteractive: false,
          prompts: {
            text: ["interactive-app", "https://fm.example.com", "reportingContacts"],
            select: ["webviewer", "hosted"],
            searchSelect: ["Contacts.fmp12", "dk_existing", "API_Contacts"],
            confirm: [true],
          },
        }),
      ),
    );

    expect(request.projectName).toBe("interactive-app");
    expect(request.appType).toBe("webviewer");
    expect(request.dataSource).toBe("filemaker");
    expect(request.fileMaker).toMatchObject({
      mode: "hosted-otto",
      server: "https://fm.example.com",
      fileName: "Contacts.fmp12",
      dataApiKey: "dk_existing",
      schemaName: "reportingContacts",
    });
  });

  it("marks explicit filemaker inputs in non-interactive mode", async () => {
    const request = await Effect.runPromise(
      resolveInitRequest("demo", {
        noGit: true,
        noInstall: true,
        force: false,
        default: false,
        importAlias: "~/",
        CI: true,
        appType: "webviewer",
        dataSource: "filemaker",
        server: "https://fm.example.com",
        fileName: "Contacts.fmp12",
        dataApiKey: "dk_123",
        layoutName: "API_Contacts",
        schemaName: "Contacts",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "pnpm",
        }),
      ),
    );

    expect(request.hasExplicitFileMakerInputs).toBe(true);
    expect(request.fileMaker).toMatchObject({
      mode: "hosted-otto",
      server: "https://fm.example.com",
      fileName: "Contacts.fmp12",
      dataApiKey: "dk_123",
      layoutName: "API_Contacts",
      schemaName: "Contacts",
    });
  });

  it("uses local fm http for webviewer setup when available", async () => {
    const request = await Effect.runPromise(
      resolveInitRequest("demo", {
        noGit: true,
        noInstall: true,
        force: false,
        default: false,
        importAlias: "~/",
        CI: false,
        appType: "webviewer",
        dataSource: "filemaker",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "pnpm",
          nonInteractive: false,
          fileMaker: {
            localFmHttp: {
              healthy: true,
              connectedFiles: ["LocalFile.fmp12"],
            },
          },
        }),
      ),
    );

    expect(request.fileMaker).toMatchObject({
      mode: "local-fm-http",
      fileName: "LocalFile.fmp12",
    });
  });
});
