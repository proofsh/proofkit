import { getOtherProofKitDependencies } from "@proofkit/registry";
import { capitalize, uniq } from "es-toolkit";
import ora from "ora";
import semver from "semver";
import * as p from "~/cli/prompts.js";

import { abortIfCancel } from "~/cli/utils.js";
import { getExistingSchemas } from "~/generators/fmdapi.js";
import { addRouteToNav } from "~/generators/route.js";
import { getRegistryUrl, shadcnInstall } from "~/helpers/shadcn-cli.js";
import { state } from "~/state.js";
import { getVersion } from "~/utils/getProofKitVersion.js";
import { logger } from "~/utils/logger.js";
import { type DataSource, getSettings, mergeSettings } from "~/utils/parseSettings.js";
import { getMetaFromRegistry } from "./getOptions.js";
import { buildHandlebarsData, randerHandlebarsToFile } from "./postInstall/handlebars.js";
import { processPostInstallStep } from "./postInstall/index.js";
import { preflightAddCommand } from "./preflight.js";

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
      message: "Which schema should this template use?",
      options: schemas.map((schema) => ({ label: schema ?? "", value: schema ?? "" })),
    }),
  );
  return schemaName;
}

export async function installFromRegistry(name: string) {
  const spinner = ora("Validating template").start();

  try {
    await preflightAddCommand();
    const meta = await getMetaFromRegistry(name);
    if (!meta) {
      spinner.fail(`Template ${name} not found in the ProofKit registry`);
      return;
    }

    if (meta.minimumProofKitVersion && semver.gt(meta.minimumProofKitVersion, getVersion())) {
      logger.error(
        `Template ${name} requires ProofKit version ${meta.minimumProofKitVersion}, but you are using version ${getVersion()}`,
      );
      spinner.fail("Template is not compatible with your ProofKit version");
      return;
    }
    spinner.succeed();

    const otherProofKitDependencies = getOtherProofKitDependencies(meta);
    let previouslyInstalledTemplates = getSettings().registryTemplates;

    // Handle schema requirement if template needs it
    let dataSource: DataSource | undefined;
    let schemaName: string | undefined;
    let routeName: string | undefined;
    let pageName: string | undefined;

    if (meta.schemaRequired) {
      const settings = getSettings();

      if (settings.dataSources.length === 0) {
        spinner.fail("This template requires a data source, but you don't have any. Add a data source first.");
        return;
      }

      const dataSourceName =
        settings.dataSources.length > 1
          ? abortIfCancel(
              await p.select({
                message: "Which data source should be used for this template?",
                options: settings.dataSources.map((ds) => ({
                  value: ds.name,
                  label: ds.name,
                })),
              }),
            )
          : settings.dataSources[0]?.name;

      dataSource = settings.dataSources.find((ds) => ds.name === dataSourceName);

      if (!dataSource) {
        spinner.fail(`Data source ${dataSourceName} not found`);
        return;
      }

      schemaName = await promptForSchemaFromDataSource({
        projectDir: state.projectDir,
        dataSource,
      });

      if (!schemaName) {
        spinner.fail("Schema selection was cancelled");
        return;
      }
    }

    if (meta.category === "page") {
      // Prompt user for the URL path of the page
      routeName = abortIfCancel(
        await p.text({
          message: "Enter the URL PATH for your new page",
          placeholder: "/my-page",
          validate: (value) => {
            if (value.length === 0) {
              return "URL path is required";
            }
            return;
          },
        }),
      );

      if (routeName.startsWith("/")) {
        routeName = routeName.slice(1);
      }

      pageName = capitalize(routeName.replace("/", "").trim());
    }

    const url = new URL(`${getRegistryUrl()}/r/${name}`);
    if (meta.category === "page") {
      url.searchParams.set("routeName", `/(main)/${routeName ?? name}`);
    }

    // a (hopefully) temporary workaround because the shadcn command installs the env file in the wrong place if it's a dependency
    if (
      name === "fmdapi" &&
      !previouslyInstalledTemplates.includes("utils/t3-env") &&
      // this last guard will allow this workaroudn to be bypassed if the registry server updates to start serving the dependency again
      meta.registryDependencies?.find((d) => d.includes("utils/t3-env")) === undefined
    ) {
      // install the t3-env template manually first
      await installFromRegistry("utils/t3-env");
      previouslyInstalledTemplates = getSettings().registryTemplates;
    }

    // now install the template using shadcn-install
    await shadcnInstall([url.toString()], meta.title);

    const handlebarsFiles = meta.files.filter((file) => file.handlebars);

    if (handlebarsFiles.length > 0) {
      // Build template data with schema information if available
      const baseTemplateData =
        dataSource && schemaName
          ? buildHandlebarsData({
              dataSource,
              schemaName,
            })
          : buildHandlebarsData();

      // Add page information to template data if available
      const templateData = {
        ...baseTemplateData,
        ...(routeName && { routeName }),
        ...(pageName && { pageName }),
      };

      // Resolve __PATH__ placeholders in file paths before handlebars processing
      const resolvedFiles = handlebarsFiles.map((file) => ({
        ...file,
        destinationPath: file.destinationPath?.replace("__PATH__", `/(main)/${routeName ?? name}`),
      }));

      for (const file of resolvedFiles) {
        await randerHandlebarsToFile(file, templateData);
      }
    }

    // Add route to navigation if this is a page template
    if (meta.category === "page" && routeName && pageName) {
      await addRouteToNav({
        projectDir: state.projectDir,
        navType: "primary",
        label: pageName,
        href: `/${routeName}`,
      });
    }

    // if post-install steps, process those
    if (meta.postInstall) {
      for (const step of meta.postInstall) {
        if (step._from && previouslyInstalledTemplates.includes(step._from)) {
          // don't re-run post-install steps for templates that have already been installed
          continue;
        }
        await processPostInstallStep(step);
      }
    }

    // update the settings
    mergeSettings({
      registryTemplates: uniq([...previouslyInstalledTemplates, name, ...otherProofKitDependencies]),
    });
  } catch (error) {
    spinner.fail("Failed to fetch template metadata.");
    logger.error(error);
  }
}
