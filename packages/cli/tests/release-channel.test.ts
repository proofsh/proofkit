import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getProofkitReleaseTag, hasAnyPrereleaseVersion } from "~/utils/proofkitReleaseChannel.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.removeSync(dir);
  }
  tempDirs.length = 0;
});

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proofkit-release-channel-"));
  tempDirs.push(dir);
  return dir;
}

describe("proofkit release channel", () => {
  it("returns beta when changesets pre mode is beta", () => {
    const tmpDir = createTempDir();
    const changesetDir = path.join(tmpDir, ".changeset");

    fs.ensureDirSync(changesetDir);
    fs.writeJSONSync(path.join(changesetDir, "pre.json"), {
      mode: "pre",
      tag: "beta",
    });

    expect(getProofkitReleaseTag(tmpDir)).toBe("beta");
  });

  it("detects prerelease versions correctly", () => {
    expect(hasAnyPrereleaseVersion(["1.2.3", "2.0.0-beta.1"])).toBe(true);
    expect(hasAnyPrereleaseVersion(["1.2.3", "2.0.0"])).toBe(false);
  });
});

