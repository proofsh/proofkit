#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

function getSkillFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const skillFiles = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      skillFiles.push(...getSkillFiles(fullPath));
      continue;
    }

    if (entry.name === "SKILL.md") {
      skillFiles.push(fullPath);
    }
  }

  return skillFiles;
}

const root = process.cwd();
const packagesDir = join(root, "packages");
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name));

let updatedCount = 0;

for (const packageDir of packageDirs) {
  const packageJsonPath = join(packageDir, "package.json");
  const skillsDir = join(packageDir, "skills");

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const skillFiles = getSkillFiles(skillsDir);

    for (const skillFile of skillFiles) {
      const content = readFileSync(skillFile, "utf8");
      const nextContent = content.replace(/^library_version:\s*"[^"]*"$/m, `library_version: "${packageJson.version}"`);

      if (nextContent === content) continue;

      writeFileSync(skillFile, nextContent);
      updatedCount += 1;
      console.log(`synced ${relative(root, skillFile)} -> ${packageJson.version}`);
    }
  } catch {}
}

if (updatedCount === 0) {
  console.log("skill versions already in sync");
}
