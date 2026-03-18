import gradient from "gradient-string";

import { TITLE_TEXT } from "~/consts.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";

const proofTheme = {
  purple: "#89216B",
  lightPurple: "#D15ABB",
  orange: "#FF595E",
};

export const proofGradient = gradient(Object.values(proofTheme));
export const renderTitle = () => {
  // resolves weird behavior where the ascii is offset
  const pkgManager = getUserPkgManager();
  if (pkgManager === "yarn" || pkgManager === "pnpm") {
    console.log("");
  }
  console.log(proofGradient.multiline(TITLE_TEXT));
};
