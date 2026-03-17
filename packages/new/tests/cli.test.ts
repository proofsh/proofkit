import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("proofkit-new CLI", () => {
  it("shows kebab-case init flags in help", () => {
    const output = execSync("pnpm build && node dist/index.js init --help", {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
      encoding: "utf8",
    });

    expect(output).toContain("--app-type");
    expect(output).toContain("--non-interactive");
    expect(output).toContain("--no-install");
    expect(output).toContain("--no-git");
    expect(output).not.toContain("--appType");
  });
});
