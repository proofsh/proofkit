import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  CliValidationError,
  ExternalCommandError,
  FileMakerSetupError,
  NonInteractiveInputError,
  UserCancelledError,
} from "~/core/errors.js";
import { resolveInitRequest } from "~/core/resolveInitRequest.js";
import { getFailure } from "./effect-test-utils.js";
import { type ConsoleTranscript, makeTestLayer, type PromptTranscript } from "./test-layer.js";

describe("resolveInitRequest", () => {
  it("uses pnpm when npm invoked and pnpm is installed", async () => {
    const request = await Effect.runPromise(
      resolveInitRequest("demo", {
        noGit: true,
        noInstall: true,
        force: false,
        default: true,
        importAlias: "~/",
        CI: true,
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "npm",
        }),
      ),
    );

    expect(request.packageManager).toBe("pnpm");
  });

  it("aborts interactively when npm invoked and pnpm is missing", async () => {
    expect(
      await getFailure(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: true,
          importAlias: "~/",
          CI: false,
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "npm",
            nonInteractive: false,
            failures: {
              packageManagerGetVersion: {
                pnpm: new ExternalCommandError({
                  message: "pnpm not found",
                  command: "pnpm",
                  args: ["-v"],
                  cwd: "/tmp",
                }),
              },
            },
          }),
        ),
      ),
    ).toMatchObject(
      new UserCancelledError({
        message: "User aborted to install pnpm first.",
      }),
    );
  });

  it("continues with npm when warning is ignored", async () => {
    const promptTranscript: PromptTranscript = {
      text: [],
      password: [],
      select: [],
      searchSelect: [],
      multiSearchSelect: [],
      confirm: [],
    };
    const request = await Effect.runPromise(
      resolveInitRequest("demo", {
        noGit: true,
        noInstall: true,
        force: false,
        default: true,
        importAlias: "~/",
        CI: false,
        appType: "browser",
        dataSource: "none",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "npm",
          nonInteractive: false,
          prompts: {
            select: ["continue"],
          },
          promptTranscript,
          failures: {
            packageManagerGetVersion: {
              pnpm: new ExternalCommandError({
                message: "pnpm not found",
                command: "pnpm",
                args: ["-v"],
                cwd: "/tmp",
              }),
            },
          },
        }),
      ),
    );

    expect(request.packageManager).toBe("npm");
    expect(promptTranscript.select[0]?.message).toContain("https://pnpm.io/installation");
  });

  it("continues with npm non-interactively when pnpm is missing", async () => {
    const request = await Effect.runPromise(
      resolveInitRequest("demo", {
        noGit: true,
        noInstall: true,
        force: false,
        default: true,
        importAlias: "~/",
        CI: true,
        appType: "browser",
        dataSource: "none",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "npm",
          failures: {
            packageManagerGetVersion: {
              pnpm: new ExternalCommandError({
                message: "pnpm not found",
                command: "pnpm",
                args: ["-v"],
                cwd: "/tmp",
              }),
            },
          },
        }),
      ),
    );

    expect(request.packageManager).toBe("npm");
  });

  it("fails for missing project name in non-interactive mode", async () => {
    expect(
      await getFailure(
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
    ).toMatchObject(
      new NonInteractiveInputError({
        message: "Project name is required in non-interactive mode.",
      }),
    );
  });

  it("fails for incomplete non-interactive filemaker inputs", async () => {
    expect(
      await getFailure(
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
    ).toMatchObject(
      new NonInteractiveInputError({
        message: "Missing required FileMaker inputs in non-interactive mode: --file-name, --data-api-key.",
      }),
    );
  });

  it("fails when only one of layout-name and schema-name is provided", async () => {
    expect(
      await getFailure(
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
    ).toMatchObject(
      new CliValidationError({
        message: "Both --layout-name and --schema-name must be provided together.",
      }),
    );
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

  it("normalizes a non-interactive layout name to the live FileMaker casing", async () => {
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
        layoutName: "contacts",
        schemaName: "Contacts",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "pnpm",
        }),
      ),
    );

    expect(request.fileMaker).toMatchObject({
      layoutName: "Contacts",
      schemaName: "Contacts",
    });
  });

  it("uses local fm http for webviewer setup when available", async () => {
    const consoleTranscript: ConsoleTranscript = {
      info: [],
      warn: [],
      error: [],
      success: [],
      note: [],
    };
    const tracker = {
      commands: [],
      gitInits: 0,
      codegens: 0,
      filemakerBootstraps: 0,
      localFmMcpAuthorizations: [],
    };

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
          console: consoleTranscript,
          tracker,
          fileMaker: {
            localFmMcp: {
              healthy: true,
              connectedFiles: ["LocalFile.fmp12"],
            },
          },
        }),
      ),
    );

    expect(request.fileMaker).toMatchObject({
      mode: "local-fm-mcp",
      fileName: "LocalFile.fmp12",
    });
    expect(tracker.localFmMcpAuthorizations).toEqual([
      {
        clientName: "ProofKit CLI (demo)",
        clientDescription: "ProofKit CLI wants to read layouts from your FileMaker file to help set up your project.",
      },
    ]);
    expect(consoleTranscript.info).toContain("Using ProofKit plugin file: LocalFile.fmp12");
  });

  it("skips local fm authorization when proofkit token is provided", async () => {
    const tracker = {
      commands: [],
      gitInits: 0,
      codegens: 0,
      filemakerBootstraps: 0,
      localFmMcpAuthorizations: [],
    };

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
        proofkitToken: "provided-token",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "pnpm",
          nonInteractive: false,
          tracker,
          fileMaker: {
            localFmMcp: {
              healthy: true,
              connectedFiles: ["LocalFile.fmp12"],
            },
          },
        }),
      ),
    );

    expect(request.proofkitToken).toBe("provided-token");
    expect(request.fileMaker).toMatchObject({
      mode: "local-fm-mcp",
      proofkitToken: "provided-token",
    });
    expect(tracker.localFmMcpAuthorizations).toEqual([]);
  });

  it("uses FM_MCP_SESSION_ID as proofkit token fallback", async () => {
    const original = process.env.FM_MCP_SESSION_ID;
    process.env.FM_MCP_SESSION_ID = "env-token";
    try {
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
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
            fileMaker: {
              localFmMcp: {
                healthy: true,
                connectedFiles: ["LocalFile.fmp12"],
              },
            },
          }),
        ),
      );

      expect(request.proofkitToken).toBe("env-token");
    } finally {
      if (original === undefined) {
        delete process.env.FM_MCP_SESSION_ID;
      } else {
        process.env.FM_MCP_SESSION_ID = original;
      }
    }
  });

  it("asks which local FileMaker file to use when multiple are open", async () => {
    const promptTranscript: PromptTranscript = {
      text: [],
      password: [],
      select: [],
      searchSelect: [],
      multiSearchSelect: [],
      confirm: [],
    };

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
          prompts: {
            searchSelect: ["B.fmp12"],
          },
          promptTranscript,
          fileMaker: {
            localFmMcp: {
              healthy: true,
              connectedFiles: ["A.fmp12", "B.fmp12"],
            },
          },
        }),
      ),
    );

    expect(request.fileMaker).toMatchObject({
      mode: "local-fm-mcp",
      fileName: "B.fmp12",
    });
    expect(promptTranscript.searchSelect).toContain(
      "Multiple FileMaker files are open. Which file should ProofKit use?",
    );
  });

  it("fails in non-interactive mode when multiple local FileMaker files are open without --file-name", async () => {
    expect(
      await getFailure(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: true,
          appType: "webviewer",
          dataSource: "filemaker",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
            fileMaker: {
              localFmMcp: {
                healthy: true,
                connectedFiles: ["A.fmp12", "B.fmp12"],
              },
            },
          }),
        ),
      ),
    ).toMatchObject(
      new NonInteractiveInputError({
        message:
          "Multiple FileMaker files are connected to the ProofKit plugin. Pass --file-name with one of: A.fmp12, B.fmp12.",
      }),
    );
  });

  it("uses --file-name for non-interactive local MCP selection when multiple files are open", async () => {
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
        fileName: "B.fmp12",
      }).pipe(
        makeTestLayer({
          cwd: "/tmp",
          packageManager: "pnpm",
          fileMaker: {
            localFmMcp: {
              healthy: true,
              connectedFiles: ["A.fmp12", "B.fmp12"],
            },
          },
        }),
      ),
    );

    expect(request.fileMaker).toMatchObject({
      mode: "local-fm-mcp",
      fileName: "B.fmp12",
    });
  });

  it("fails when --file-name does not match a connected local FileMaker file", async () => {
    expect(
      await getFailure(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: true,
          appType: "webviewer",
          dataSource: "filemaker",
          fileName: "Missing.fmp12",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
            fileMaker: {
              localFmMcp: {
                healthy: true,
                connectedFiles: ["A.fmp12", "B.fmp12"],
              },
            },
          }),
        ),
      ),
    ).toMatchObject(
      new FileMakerSetupError({
        message:
          'FileMaker file "Missing.fmp12" is not currently connected to the ProofKit plugin. Connected files: A.fmp12, B.fmp12.',
      }),
    );
  });

  it("propagates a typed hosted FileMaker validation error", async () => {
    expect(
      await getFailure(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: true,
          appType: "browser",
          dataSource: "filemaker",
          server: "https://bad.example.com",
          fileName: "Contacts.fmp12",
          dataApiKey: "dk_123",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
            failures: {
              validateHostedServerUrl: new FileMakerSetupError({
                message: "Invalid FileMaker Server URL: https://bad.example.com",
              }),
            },
          }),
        ),
      ),
    ).toMatchObject(
      new FileMakerSetupError({
        message: "Invalid FileMaker Server URL: https://bad.example.com",
      }),
    );
  });

  it("prompts to retry when ProofKit plugin is installed but no FileMaker file is connected", async () => {
    const promptTranscript: PromptTranscript = {
      text: [],
      password: [],
      select: [],
      searchSelect: [],
      multiSearchSelect: [],
      confirm: [],
    };
    const tracker = {
      commands: [],
      gitInits: 0,
      codegens: 0,
      filemakerBootstraps: 0,
      addonInstalls: 0,
    };

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
          tracker,
          prompts: {
            select: ["skip"],
          },
          promptTranscript,
          fileMaker: {
            localFmMcp: {
              healthy: true,
              connectedFiles: [],
            },
          },
        }),
      ),
    );

    expect(request.fileMaker).toBeUndefined();
    expect(request.skipFileMakerSetup).toBe(true);
    expect(tracker.addonInstalls).toBe(1);
    expect(promptTranscript.select).toContainEqual({
      message:
        "ProofKit plugin is installed, but no FileMaker file is connected yet. Install the ProofKit Web Viewer add-on in your FileMaker file, run the add-on connection script, then choose how to continue.",
      options: ["retry", "hosted", "skip"],
    });
  });

  it("retries local MCP detection, then reports the connected file", async () => {
    const consoleTranscript: ConsoleTranscript = {
      info: [],
      warn: [],
      error: [],
      success: [],
      note: [],
    };
    const tracker = {
      commands: [],
      gitInits: 0,
      codegens: 0,
      filemakerBootstraps: 0,
      addonInstalls: 0,
    };

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
          tracker,
          prompts: {
            select: ["retry"],
          },
          console: consoleTranscript,
          fileMaker: {
            localFmMcp: [
              {
                healthy: true,
                connectedFiles: [],
              },
              {
                healthy: true,
                connectedFiles: ["RetryConnected.fmp12"],
              },
            ],
          },
        }),
      ),
    );

    expect(request.fileMaker).toMatchObject({
      mode: "local-fm-mcp",
      fileName: "RetryConnected.fmp12",
    });
    expect(tracker.addonInstalls).toBe(2);
    expect(consoleTranscript.info).toContain("Using ProofKit plugin file: RetryConnected.fmp12");
  });

  it("fails with a specific non-interactive error when ProofKit plugin is installed but no FileMaker file is connected", async () => {
    expect(
      await getFailure(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: true,
          appType: "webviewer",
          dataSource: "filemaker",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
            fileMaker: {
              localFmMcp: {
                healthy: true,
                connectedFiles: [],
              },
            },
          }),
        ),
      ),
    ).toMatchObject(
      new NonInteractiveInputError({
        message:
          "ProofKit plugin was detected, but no FileMaker file is connected. Install the ProofKit plugin, install the ProofKit Web Viewer add-on in your FileMaker file, then run the add-on connection script and rerun. Or pass --server.",
      }),
    );
  });

  it("propagates a typed demo deployment error", async () => {
    expect(
      await getFailure(
        resolveInitRequest("demo", {
          noGit: true,
          noInstall: true,
          force: false,
          default: false,
          importAlias: "~/",
          CI: false,
          appType: "browser",
          dataSource: "filemaker",
          server: "https://fm.example.com",
        }).pipe(
          makeTestLayer({
            cwd: "/tmp",
            packageManager: "pnpm",
            nonInteractive: false,
            prompts: {
              searchSelect: ["$deploy-demo"],
            },
            failures: {
              deployDemoFile: new FileMakerSetupError({
                message: "ProofKit Demo deployment timed out after 5 minutes.",
              }),
            },
          }),
        ),
      ),
    ).toMatchObject(
      new FileMakerSetupError({
        message: "ProofKit Demo deployment timed out after 5 minutes.",
      }),
    );
  });

  it("fails with a typed cancelation error when a prompt is cancelled", async () => {
    expect(
      await getFailure(
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
              text: ["__cancel__"],
            },
          }),
        ),
      ),
    ).toMatchObject(
      new UserCancelledError({
        message: "User aborted the operation",
      }),
    );
  });
});
