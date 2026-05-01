/**
 * Build Add-on Pipeline
 * Automates building the ProofKit FileMaker add-on.
 *
 * Flow:
 *   1. Pre-clean AddonModules directory
 *   2. Open addon-creator.fmp12 in FileMaker
 *   3. Run SaveAsPackage script (which opens ProofKit.fmp12 internally)
 *   4. Poll for .fmaddon output
 *   5. Fix info_en.json (description, category, BOM)
 *   6. Re-run SaveAsPackage to regenerate with fixed JSON
 *   7. Close addon-creator via CloseThisFile script
 *   8. Copy .fmaddon and zip addon folder to stage directory
 *   9. Refresh CLI template (packages/cli/template/fm-addon/ProofKitWV/)
 */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ADDON_NAME = "ProofKit";
const ADDON_DESCRIPTION = "ProofKit for FileMaker";
const ADDON_CATEGORY = "Development";
const FM_CONTROLLER = "addon-creator.fmp12";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");

const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const version = packageJson.version;

const addonCreatorPath = join(repoRoot, "fm-addon", FM_CONTROLLER);
const stageDir = join(repoRoot, "fm-addon", "stage");
const addonModulesDir = join(homedir(), "Library/Application Support/FileMaker/Extensions/AddonModules");
const fmaddonPath = join(addonModulesDir, `${ADDON_NAME}.fmaddon`);
const addonFolderPath = join(addonModulesDir, ADDON_NAME);
const infoJsonPath = join(addonFolderPath, "info_en.json");

function log(prefix, msg) {
  console.log(`${prefix} ${msg}`);
}
function section(title) {
  console.log(`\n${"=".repeat(70)}`);
  log("\u{1F4CB}", title);
  console.log("=".repeat(70));
  console.log("");
}
function info(msg) {
  log("\u2139\uFE0F", msg);
}
function success(msg) {
  log("\u2705", msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForFile(filePath, timeout = 60_000, interval = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (existsSync(filePath)) return true;
    await sleep(interval);
  }
  throw new Error(`Timeout waiting for file: ${filePath}`);
}

function openPath(target) {
  execSync(`open "${target}"`);
}

console.log("=".repeat(70));
console.log("\u{1F527} ProofKit Add-on Build Pipeline");
console.log("=".repeat(70));
console.log(`Version:          ${version}`);
console.log(`Controller:       ${addonCreatorPath}`);
console.log(`Stage Directory:  ${stageDir}`);
console.log(`AddonModules:     ${addonModulesDir}`);
console.log("=".repeat(70));
console.log("");

try {
  // --- Step 1: Pre-clean AddonModules directory ---
  section("Step 1: Pre-clean AddonModules Directory");

  if (existsSync(fmaddonPath)) {
    info(`Removing old .fmaddon: ${fmaddonPath}`);
    rmSync(fmaddonPath, { force: true });
  }
  if (existsSync(addonFolderPath)) {
    info(`Removing old folder: ${addonFolderPath}`);
    rmSync(addonFolderPath, { recursive: true, force: true });
  }

  success("AddonModules directory cleaned");

  // --- Step 2: Ensure stage directory ---
  section("Step 2: Prepare Stage Directory");

  if (!existsSync(stageDir)) {
    mkdirSync(stageDir, { recursive: true });
  }
  success(`Stage directory ready: ${stageDir}`);

  // --- Step 3: Verify source file ---
  section("Step 3: Verify Source Files");

  if (!existsSync(addonCreatorPath)) {
    throw new Error(`Controller file not found: ${addonCreatorPath}`);
  }
  success(`Found: ${addonCreatorPath}`);

  // --- Step 4: Open addon-creator in FileMaker ---
  section("Step 4: Open FileMaker");

  info(`Opening ${FM_CONTROLLER}...`);
  openPath(addonCreatorPath);

  info("Waiting 10 seconds for FileMaker to fully load...");
  await sleep(10_000);

  success("FileMaker loaded");

  // --- Step 5: Run SaveAsPackage ---
  section("Step 5: Run SaveAsPackage Script");

  const saveUrl = `fmp://$/addon-creator.fmp12?script=SaveAsPackage&param=${version}`;
  info(`Triggering SaveAsPackage with version ${version}...`);
  openPath(saveUrl);

  success("Script triggered");

  // --- Step 6: Poll for .fmaddon file ---
  section("Step 6: Wait for Add-on Generation");

  info(`Polling for ${fmaddonPath}...`);
  await waitForFile(fmaddonPath);

  info("Add-on file detected, waiting 5 seconds for filesystem to settle...");
  await sleep(5000);

  success(".fmaddon file created");

  // --- Step 7: Fix info_en.json ---
  section("Step 7: Fix info_en.json");

  if (!existsSync(infoJsonPath)) {
    throw new Error(`info_en.json not found at: ${infoJsonPath}`);
  }

  info("Reading info_en.json...");
  let jsonContent = readFileSync(infoJsonPath, "utf8");

  jsonContent = jsonContent.replace(/"\*\*\* DESCRIPTION MISSING \*\*\* - DNL"/g, `"${ADDON_DESCRIPTION}"`);
  jsonContent = jsonContent.replace(/"___\.\.\.___"/g, `"${ADDON_CATEGORY}"`);

  const BOM = "\uFEFF";
  if (!jsonContent.startsWith(BOM)) {
    jsonContent = BOM + jsonContent;
  }

  writeFileSync(infoJsonPath, jsonContent, "utf8");

  success("info_en.json fixed with description, category, and BOM");

  // --- Step 8: Re-run SaveAsPackage with fixed JSON ---
  section("Step 8: Re-run SaveAsPackage");

  info("Triggering SaveAsPackage again to include fixed JSON...");
  openPath(saveUrl);

  info("Waiting 5 seconds for regeneration...");
  await sleep(5000);

  success("Add-on regenerated with fixed info_en.json");

  // --- Step 9: Close FileMaker ---
  section("Step 9: Close FileMaker");

  const closeUrl = "fmp://$/addon-creator.fmp12?script=CloseThisFile";
  info(`Closing ${FM_CONTROLLER}...`);
  openPath(closeUrl);

  info("Waiting 2 seconds for file to close...");
  await sleep(2000);

  success("FileMaker file closed");

  // --- Step 10: Copy .fmaddon to stage ---
  section("Step 10: Stage Build Artifacts");

  const stageFmaddonPath = join(stageDir, `${ADDON_NAME}.fmaddon`);
  info(`Copying .fmaddon to: ${stageFmaddonPath}`);
  copyFileSync(fmaddonPath, stageFmaddonPath);
  success(`Copied: ${stageFmaddonPath}`);

  // --- Step 11: Zip addon folder to stage ---
  const stageZipPath = join(stageDir, `${ADDON_NAME}.zip`);
  info(`Creating zip at: ${stageZipPath}`);

  if (existsSync(stageZipPath)) {
    rmSync(stageZipPath, { force: true });
  }

  execSync(`cd "${addonModulesDir}" && zip -r "${stageZipPath}" "${ADDON_NAME}"`);
  success(`Created: ${stageZipPath}`);

  // --- Step 12: Refresh CLI template ---
  section("Step 12: Update CLI Template");

  const cliTemplatePath = join(repoRoot, "packages/cli/template/fm-addon/ProofKitWV");

  info(`Clearing ${cliTemplatePath}...`);
  if (existsSync(cliTemplatePath)) {
    rmSync(cliTemplatePath, { recursive: true, force: true });
  }
  mkdirSync(cliTemplatePath, { recursive: true });

  info("Copying addon folder contents to CLI template...");
  execSync(`cp -a "${addonFolderPath}/"* "${cliTemplatePath}/"`);

  success(`CLI template updated: ${cliTemplatePath}`);

  // --- Done ---
  console.log("");
  console.log("=".repeat(70));
  console.log("\u{1F389} Add-on Pipeline Complete!");
  console.log("=".repeat(70));
  console.log("Staged Files:");
  console.log(`  ${stageFmaddonPath}`);
  console.log(`  ${stageZipPath}`);
  console.log("");
  console.log("CLI Template Updated:");
  console.log(`  ${cliTemplatePath}`);
  console.log("");
  console.log("Original Files (preserved):");
  console.log(`  ${fmaddonPath}`);
  console.log(`  ${addonFolderPath}`);
  console.log("=".repeat(70));
  console.log("");

  process.exit(0);
} catch (err) {
  console.error("");
  console.error("=".repeat(70));
  console.error(`\u274C Add-on pipeline failed: ${err.message}`);
  console.error("=".repeat(70));
  process.exit(1);
}
