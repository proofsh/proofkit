import { type appTypes, getSettings, mergeSettings } from "~/utils/parseSettings.js";
import { copyCursorRules } from "./cursorRules.js";
import { addShadcn } from "./shadcn.js";

interface Upgrade {
  key: string;
  title: string;
  description: string;
  appType: (typeof appTypes)[number][];
  function: () => Promise<void>;
}

const availableUpgrades: Upgrade[] = [
  {
    key: "cursorRules",
    title: "Upgrade Cursor Rules",
    description: "Upgrade the .cursor rules in your project to the latest version.",
    appType: ["browser"],
    function: copyCursorRules,
  },
  {
    key: "shadcn",
    title: "Add Shadcn",
    description:
      "Add Shadcn to your project, to support easily adding new components from a variety of component registries.",
    appType: ["browser", "webviewer"],
    function: addShadcn,
  },
];

export type UpgradeKeys = (typeof availableUpgrades)[number]["key"];

export function checkForAvailableUpgrades() {
  const settings = getSettings();
  if (settings.ui === "shadcn") {
    return [];
  }

  const appliedUpgrades = settings.appliedUpgrades;

  const neededUpgrades = availableUpgrades.filter(
    (upgrade) => !appliedUpgrades.includes(upgrade.key) && upgrade.appType.includes(settings.appType),
  );

  return neededUpgrades.map(({ key, title, description }) => ({
    key,
    title,
    description,
  }));
}

export async function runAllAvailableUpgrades() {
  const upgrades = checkForAvailableUpgrades();
  const settings = getSettings();
  if (settings.ui === "shadcn") {
    return;
  }

  for (const upgrade of upgrades) {
    const upgradeFunction = availableUpgrades.find((u) => u.key === upgrade.key)?.function;
    if (upgradeFunction) {
      await upgradeFunction();
      const appliedUpgrades = settings.appliedUpgrades;
      mergeSettings({
        appliedUpgrades: [...appliedUpgrades, upgrade.key],
      });
    }
  }
}
