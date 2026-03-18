import chalk from "chalk";
import open from "open";
import { confirm, log, select } from "~/cli/prompts.js";

import { DOCS_URL } from "~/consts.js";
import { checkForAvailableUpgrades, runAllAvailableUpgrades } from "~/upgrades/index.js";
import { getSettings } from "~/utils/parseSettings.js";
import { runAdd } from "./add/index.js";
import { runDeploy } from "./deploy/index.js";
import { runRemove } from "./remove/index.js";
import { runTypegen } from "./typegen/index.js";
import { runUpgrade } from "./update/index.js";
import { abortIfCancel } from "./utils.js";

export const runMenu = async () => {
  const settings = getSettings();
  const upgrades = checkForAvailableUpgrades();

  if (upgrades.length > 0) {
    log.info(
      `${chalk.yellow("There are upgrades available for your ProofKit project")}\n${upgrades
        .map((upgrade) => `- ${upgrade.title}`)
        .join("\n")}`,
    );

    const shouldRunUpgrades = abortIfCancel(
      await confirm({
        message: "Would you like to run them now?",
        initialValue: true,
      }),
    );

    if (shouldRunUpgrades) {
      await runAllAvailableUpgrades();
      log.success(chalk.green("Successfully ran all upgrades"));
    } else {
      log.info(`You can apply the upgrades later by running ${chalk.cyan("proofkit upgrade")}`);
    }
  }

  const menuChoice = abortIfCancel(
    await select({
      message: "What would you like to do?",
      options: [
        {
          label: "Add Components",
          value: "add",
          hint: "Add new pages, schemas, data sources, etc.",
        },
        {
          label: "Remove Components",
          value: "remove",
          hint: "Remove pages, schemas, data sources, etc.",
        },
        {
          label: "Generate Types",
          value: "typegen",
          hint: "Update field definitions from your data sources",
        },
        {
          label: "Deploy",
          value: "deploy",
          hint: "Deploy your app to Vercel",
        },
        {
          label: "Upgrade Components",
          value: "upgrade",
          hint: "Update ProofKit components to latest version",
        },
        {
          label: "View Documentation",
          value: "docs",
          hint: "Open ProofKit documentation",
        },
      ],
    }),
  );

  switch (menuChoice) {
    case "add":
      await runAdd(undefined);
      break;
    case "remove":
      await runRemove(undefined);
      break;
    case "docs":
      log.info(`Opening ${chalk.cyan(DOCS_URL)} in your browser...`);
      await open(DOCS_URL);
      break;
    case "typegen":
      await runTypegen({ settings });
      break;
    case "deploy":
      await runDeploy();
      break;
    case "upgrade":
      await runUpgrade();
      break;
    default:
      throw new Error(`Unknown menu choice: ${menuChoice}`);
  }
};
