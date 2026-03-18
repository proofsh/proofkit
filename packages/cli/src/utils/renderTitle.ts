import gradient from "gradient-string";
import { getTitleText } from "~/consts.js";
import { detectUserPackageManager } from "~/utils/packageManager.js";

const proofTheme = {
  purple: "#89216B",
  lightPurple: "#D15ABB",
  orange: "#FF595E",
};

export const proofGradient = gradient(Object.values(proofTheme));
export function renderTitle(version = "0.0.0-private") {
  const pkgManager = detectUserPackageManager();
  if (pkgManager === "yarn" || pkgManager === "pnpm") {
    console.log("");
  }
  console.log(proofGradient.multiline(getTitleText(version)));
}
