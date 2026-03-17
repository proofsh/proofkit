import path from "node:path";
import fs from "fs-extra";
import semver from "semver";

import {
  getFmdapiVersion,
  getProofkitBetterAuthVersion,
  getProofkitWebviewerVersion,
  getTypegenVersion,
  getVersion,
} from "~/utils/getProofKitVersion.js";

export type ProofkitReleaseTag = "latest" | "beta";

interface ChangesetPreState {
  mode?: string;
  tag?: string;
}

function findRepoRootWithChangeset(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const { root } = path.parse(currentDir);

  while (currentDir !== root) {
    if (fs.existsSync(path.join(currentDir, ".changeset"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

function readChangesetPreState(startDir = process.cwd()): ChangesetPreState | null {
  const repoRoot = findRepoRootWithChangeset(startDir);
  if (!repoRoot) {
    return null;
  }

  const prePath = path.join(repoRoot, ".changeset", "pre.json");
  if (!fs.existsSync(prePath)) {
    return null;
  }

  try {
    return fs.readJSONSync(prePath) as ChangesetPreState;
  } catch {
    return null;
  }
}

export function hasAnyPrereleaseVersion(versionCandidates?: Array<string | null>) {
  if (versionCandidates) {
    return versionCandidates.some((version) => semver.valid(version) && semver.prerelease(version));
  }

  const readVersion = (getter: () => string) => {
    try {
      return getter();
    } catch {
      return null;
    }
  };

  const proofkitVersions = [
    readVersion(getVersion),
    readVersion(getFmdapiVersion),
    readVersion(getProofkitWebviewerVersion),
    readVersion(getTypegenVersion),
    readVersion(getProofkitBetterAuthVersion),
  ].filter((version): version is string => Boolean(version));

  return proofkitVersions.some((version) => semver.valid(version) && semver.prerelease(version));
}

export function getProofkitReleaseTag(startDir = process.cwd()): ProofkitReleaseTag {
  const preState = readChangesetPreState(startDir);

  if (preState?.mode === "pre" && preState.tag === "beta") {
    return "beta";
  }

  if (hasAnyPrereleaseVersion()) {
    return "beta";
  }

  return "latest";
}
