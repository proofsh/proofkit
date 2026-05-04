#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
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

const mismatches = [];

for (const packageDir of packageDirs) {
  const packageJsonPath = join(packageDir, "package.json");
  const skillsDir = join(packageDir, "skills");

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const skillFiles = getSkillFiles(skillsDir);

    for (const skillFile of skillFiles) {
      const content = readFileSync(skillFile, "utf8");
      const match = content.match(/^library_version:\s*"([^"]*)"$/m);
      const skillVersion = match?.[1];

      if (!skillVersion || skillVersion === packageJson.version) continue;

      mismatches.push({
        actual: skillVersion,
        expected: packageJson.version,
        file: relative(root, skillFile),
      });
    }
  } catch {}
}

if (mismatches.length === 0) {
  console.log("skill versions in sync");
  process.exit(0);
}

for (const mismatch of mismatches) {
  console.error(`${mismatch.file}: library_version=${mismatch.actual} expected=${mismatch.expected}`);
}

process.exit(1);
