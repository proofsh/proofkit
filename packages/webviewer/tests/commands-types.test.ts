import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

const runTypeScript = (source: string) => {
  const dir = mkdtempSync(join(tmpdir(), "proofkit-webviewer-types-"));
  const configPath = join(dir, "tsconfig.json");
  const sourcePath = join(dir, "index.ts");
  const commandsPath = resolve(import.meta.dirname, "../src/commands.ts");

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: "ESNext",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["DOM", "ESNext"],
          baseUrl: ".",
          paths: {
            "@proofkit/webviewer/commands": [commandsPath],
          },
        },
        include: [sourcePath],
      },
      null,
      2,
    ),
  );
  writeFileSync(sourcePath, source);

  execFileSync(process.execPath, [tscPath, "--project", configPath], {
    cwd: join(import.meta.dirname, "../../.."),
    stdio: "pipe",
  });
};

describe("web viewer command types", () => {
  it("allows valid string-parameter registry declarations", () => {
    expect(() =>
      runTypeScript(`
        import {
          type DefineWebViewerCommandRegistry,
          initWebViewerCommands,
          registerWebViewerCommand,
        } from "@proofkit/webviewer/commands";

        declare module "@proofkit/webviewer/commands" {
          interface WebViewerCommandRegistry
            extends DefineWebViewerCommandRegistry<{
            openCustomer: (recordId: string) => void;
            refreshDashboard: () => void;
          }> {}
        }

        initWebViewerCommands();
        registerWebViewerCommand("openCustomer", (recordId) => {
          recordId.toUpperCase();
        });
      `),
    ).not.toThrow();
  }, 15_000);

  it("rejects invalid registry declarations through the helper type", () => {
    expect(() =>
      runTypeScript(`
        import { type DefineWebViewerCommandRegistry } from "@proofkit/webviewer/commands";

        declare module "@proofkit/webviewer/commands" {
          interface WebViewerCommandRegistry
            extends DefineWebViewerCommandRegistry<{
            openCustomer: (recordId: string) => void;
            badParameter: (recordId: number) => void;
            badValue: string;
          }> {}
        }
      `),
    ).toThrow();
  }, 15_000);

  it("rejects unknown commands and wrong handler signatures", () => {
    expect(() =>
      runTypeScript(`
        import { registerWebViewerCommand } from "@proofkit/webviewer/commands";

        declare module "@proofkit/webviewer/commands" {
          interface WebViewerCommandRegistry {
            openCustomer: (recordId: string) => void;
          }
        }

        // @ts-expect-error unknown command name
        registerWebViewerCommand("refreshDashboard", () => {});

        // @ts-expect-error command requires a string parameter
        registerWebViewerCommand("openCustomer", (recordId: number) => {});
      `),
    ).not.toThrow();
  }, 15_000);
});
