import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { capitalize } from "es-toolkit";
import fs from "fs-extra";
import { nextjsTemplates, wvTemplates } from "~/cli/add/page/templates.js";
import * as p from "~/cli/prompts.js";
import { PKG_ROOT } from "~/consts.js";
import { getExistingSchemas } from "~/generators/fmdapi.js";
import { addRouteToNav } from "~/generators/route.js";
import { ciOption, debugOption, nonInteractiveOption } from "~/globalOptions.js";
import { initProgramState, isNonInteractiveMode, state } from "~/state.js";
import { getUserPkgManager } from "~/utils/getUserPkgManager.js";
import { type DataSource, getSettings, mergeSettings } from "~/utils/parseSettings.js";
import { abortIfCancel, ensureProofKitProject } from "../../utils.js";

export const runAddPageAction = async (opts?: {
  routeName?: string;
  pageName?: string;
  dataSourceName?: string;
  schemaName?: string;
  template?: string;
}) => {
  const projectDir = state.projectDir;

  const settings = getSettings();
  if (settings.ui === "shadcn") {
    return p.cancel("Adding pages is not yet supported for shadcn-based projects.");
  }

  const templates = state.appType === "browser" ? Object.entries(nextjsTemplates) : Object.entries(wvTemplates);

  if (templates.length === 0) {
    return p.cancel("No templates found for your app type. Check back soon!");
  }

  let routeName = opts?.routeName;
  let replacedMainPage = settings.replacedMainPage;

  if (state.appType === "webviewer" && !replacedMainPage && !isNonInteractiveMode() && !routeName) {
    const replaceMainPage = abortIfCancel(
      await p.select({
        message: "Do you want to replace the default page?",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No, maybe later", value: "no" },
          { label: "No, don't ask again", value: "never" },
        ],
      }),
    );
    if (replaceMainPage === "never" || replaceMainPage === "yes") {
      replacedMainPage = true;
    }

    if (replaceMainPage === "yes") {
      routeName = "/";
    }
  }

  if (!routeName) {
    routeName = abortIfCancel(
      await p.text({
        message: "Enter the URL PATH for your new page",
        validate: (value) => {
          if (value.length === 0) {
            return "URL path is required";
          }
          return;
        },
      }),
    );
  }

  if (!routeName.startsWith("/")) {
    routeName = `/${routeName}`;
  }

  const pageName = capitalize(routeName.replace("/", "").trim());

  const template =
    opts?.template ??
    abortIfCancel(
      await p.select({
        message: "What template should be used for this page?",
        options: templates.map(([key, value]) => ({
          value: key,
          label: `${value.label}`,
          hint: value.hint,
        })),
      }),
    );

  const pageTemplate = templates.find(([key]) => key === template)?.[1];
  if (!pageTemplate) {
    return p.cancel(`Page template ${template} not found`);
  }

  let dataSource: DataSource | undefined;
  let schemaName: string | undefined;
  if (pageTemplate.requireData) {
    if (settings.dataSources.length === 0) {
      return p.cancel(
        "This template requires a data source, but you don't have any. Add a data source first, or choose another page template",
      );
    }

    const dataSourceName =
      opts?.dataSourceName ??
      (settings.dataSources.length > 1
        ? abortIfCancel(
            await p.select({
              message: "Which data source should be used for this page?",
              options: settings.dataSources.map((dataSource) => ({
                value: dataSource.name,
                label: dataSource.name,
              })),
            }),
          )
        : settings.dataSources[0]?.name);

    dataSource = settings.dataSources.find((dataSource) => dataSource.name === dataSourceName);
    if (!dataSource) {
      return p.cancel(`Data source ${dataSourceName} not found`);
    }

    schemaName = await promptForSchemaFromDataSource({
      projectDir,
      dataSource,
    });
  }

  const spinner = p.spinner();
  spinner.start("Adding page from template");

  // copy template files
  const templatePath = path.join(PKG_ROOT, "template/pages", pageTemplate.templatePath);

  const destPath =
    state.appType === "browser"
      ? path.join(projectDir, "src/app/(main)", routeName)
      : path.join(projectDir, "src/routes", routeName);

  await fs.copy(templatePath, destPath);

  if (state.appType === "browser") {
    if (pageName && pageName !== "") {
      await addRouteToNav({
        projectDir: process.cwd(),
        navType: "primary",
        label: pageName,
        href: routeName,
      });
    }
  } else if (state.appType === "webviewer") {
    // TODO: implement
  }
  // call post-install function
  await pageTemplate.postIntallFn?.({
    projectDir,
    pageDir: destPath,
    dataSource,
    schemaName,
  });

  if (replacedMainPage !== settings.replacedMainPage) {
    // avoid changing this until the end since the user could cancel early
    mergeSettings({ replacedMainPage });
  }

  spinner.stop("Added page!");
  const pkgManager = getUserPkgManager();

  console.log(
    `\n${chalk.green("Next steps:")}\nTo preview this page, restart your dev server using the ${chalk.cyan(`${pkgManager === "npm" ? "npm run" : pkgManager} dev`)} command\n`,
  );
};

export const makeAddPageCommand = () => {
  const addPageCommand = new Command("page").description("Add a new page to your project").action(async () => {
    await runAddPageAction();
  });

  addPageCommand.addOption(ciOption);
  addPageCommand.addOption(nonInteractiveOption);
  addPageCommand.addOption(debugOption);

  addPageCommand.hook("preAction", () => {
    initProgramState(addPageCommand.opts());
    state.baseCommand = "add";
    ensureProofKitProject({ commandName: "add" });
  });

  return addPageCommand;
};

async function promptForSchemaFromDataSource({
  projectDir = process.cwd(),
  dataSource,
}: {
  projectDir?: string;
  dataSource: DataSource;
}) {
  if (dataSource.type === "supabase") {
    throw new Error("Not implemented");
  }
  const schemas = getExistingSchemas({
    projectDir,
    dataSourceName: dataSource.name,
  })
    .map((s) => s.schemaName)
    .filter(Boolean);

  if (schemas.length === 0) {
    p.cancel("This data source doesn't have any schemas to load data from");
    return undefined;
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  const schemaName = abortIfCancel(
    await p.select({
      message: "Which schema should this page load data from?",
      options: schemas.map((schema) => ({ label: schema ?? "", value: schema ?? "" })),
    }),
  );
  return schemaName;
}
