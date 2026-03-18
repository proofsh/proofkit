import path from "node:path";
import fs from "fs-extra";

import { PKG_ROOT } from "~/consts.js";
import { state } from "~/state.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";

export async function copyCursorRules() {
  const projectDir = state.projectDir;
  const extrasDir = path.join(PKG_ROOT, "template/extras");
  const cursorRulesSrcDir = path.join(extrasDir, "_cursor/rules");
  const cursorRulesDestDir = path.join(projectDir, ".cursor/rules");

  if (!fs.existsSync(cursorRulesSrcDir)) {
    return;
  }

  const pkgManager = getUserPkgManager();
  await fs.ensureDir(cursorRulesDestDir);
  await fs.copy(cursorRulesSrcDir, cursorRulesDestDir);

  // Copy package manager specific rules
  const conditionalRulesDir = path.join(extrasDir, "_cursor/conditional-rules");

  const packageManagerRules = {
    pnpm: "pnpm.mdc",
    npm: "npm.mdc",
    yarn: "yarn.mdc",
  };

  const selectedRule = packageManagerRules[pkgManager as keyof typeof packageManagerRules];

  if (selectedRule) {
    const ruleSrc = path.join(conditionalRulesDir, selectedRule);
    const ruleDest = path.join(cursorRulesDestDir, "package-manager.mdc");

    if (fs.existsSync(ruleSrc)) {
      await fs.copy(ruleSrc, ruleDest, { overwrite: true });
    }
  }
}
