import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const binDir = path.join(packageRoot, "bin");
const entrypoint = path.join(packageRoot, "src", "index.ts");

const targets = [
  { target: "bun-darwin-arm64", file: "proofkit-darwin-arm64" },
  { target: "bun-darwin-x64", file: "proofkit-darwin-x64" },
  { target: "bun-linux-arm64", file: "proofkit-linux-arm64" },
  { target: "bun-linux-x64", file: "proofkit-linux-x64" },
  { target: "bun-windows-arm64", file: "proofkit-windows-arm64.exe" },
  { target: "bun-windows-x64", file: "proofkit-windows-x64.exe" },
];

const selectedTargets = new Set(
  (process.env.PROOFKIT_BINARY_TARGETS ?? "")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean),
);

mkdirSync(binDir, { recursive: true });
for (const file of readdirSync(binDir)) {
  if (file === "proofkit.cjs") {
    continue;
  }
  rmSync(path.join(binDir, file), { recursive: true, force: true });
}

for (const config of targets) {
  if (selectedTargets.size > 0 && !selectedTargets.has(config.target)) {
    continue;
  }

  const outfile = path.join(binDir, config.file);
  const result = spawnSync(
    "bun",
    [
      "build",
      "--compile",
      `--target=${config.target}`,
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      "--no-compile-autoload-tsconfig",
      "--no-compile-autoload-package-json",
      entrypoint,
      `--outfile=${outfile}`,
    ],
    {
      cwd: packageRoot,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (existsSync(outfile) && !outfile.endsWith(".exe")) {
    chmodSync(outfile, 0o755);
  }
}
