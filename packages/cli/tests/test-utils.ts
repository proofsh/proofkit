import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function execSmokeCommand(command: string, options: Parameters<typeof execSync>[1]) {
  try {
    return execSync(command, {
      ...options,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (error) {
    if (error && typeof error === "object") {
      const outputError = error as { stdout?: unknown; stderr?: unknown };
      if (typeof outputError.stdout === "string" && outputError.stdout.length > 0) {
        console.error(outputError.stdout);
      }
      if (typeof outputError.stderr === "string" && outputError.stderr.length > 0) {
        console.error(outputError.stderr);
      }
    }
    throw error;
  }
}

/**
 * Smoke-test helper only: swap workspace refs to published tags so install/build
 * validates what end users can actually fetch from the registry.
 */
function applyPublishedProofkitVersionsForSmoke(projectDir: string): void {
  const pkgPath = join(projectDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  const replaceProofkitVersions = (deps: Record<string, string> | undefined) => {
    if (!deps) {
      return;
    }
    for (const name of Object.keys(deps)) {
      if (name.startsWith("@proofkit/")) {
        console.log(`  Replacing ${name}@${deps[name]} with latest`);
        deps[name] = "latest";
      }
    }
  };

  console.log("Using latest published @proofkit/* versions...");
  replaceProofkitVersions(pkg.dependencies);
  replaceProofkitVersions(pkg.devDependencies);

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

/**
 * Verifies that a project at the given directory can be built without errors
 * @param projectDir The directory containing the project to build
 * @throws If the build fails
 */
export function verifySmokeProjectBuilds(projectDir: string): void {
  console.log(`\nVerifying project build in ${projectDir}...`);

  try {
    // Smoke tests intentionally validate published package installability.
    applyPublishedProofkitVersionsForSmoke(projectDir);

    console.log("Installing dependencies...");
    execSmokeCommand("pnpm install --prefer-offline --no-frozen-lockfile", {
      cwd: projectDir,
      env: {
        ...process.env,
        PNPM_DEBUG: "1", // Enable debug logging
      },
    });

    console.log("Building project...");
    execSmokeCommand("pnpm build", {
      cwd: projectDir,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
  } catch (error) {
    console.error("Build process failed:", error);
    throw error;
  }
}
