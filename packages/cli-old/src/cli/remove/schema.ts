import { Command } from "commander";
import { z } from "zod/v4";
import * as p from "~/cli/prompts.js";

import { getExistingSchemas, removeLayout } from "~/generators/fmdapi.js";
import { state } from "~/state.js";
import { getSettings, type Settings } from "~/utils/parseSettings.js";
import { abortIfCancel } from "../utils.js";

export const runRemoveSchemaAction = async (opts?: {
  projectDir?: string;
  settings?: Settings;
  sourceName?: string;
  schemaName?: string;
}) => {
  const settings = opts?.settings ?? getSettings();
  const projectDir = opts?.projectDir ?? state.projectDir;
  let sourceName = opts?.sourceName;

  // If there is more than one fm data source, prompt for which one to remove from
  if (!sourceName && settings.dataSources.filter((s) => s.type === "fm").length > 1) {
    const dataSourceName = await p.select({
      message: "Which FileMaker data source do you want to remove a layout from?",
      options: settings.dataSources.filter((s) => s.type === "fm").map((s) => ({ label: s.name, value: s.name })),
    });
    if (p.isCancel(dataSourceName)) {
      p.cancel();
      process.exit(0);
    }
    sourceName = z.string().parse(dataSourceName);
  }

  if (!sourceName) {
    sourceName = "filemaker";
  }

  const dataSource = settings.dataSources.filter((s) => s.type === "fm").find((s) => s.name === sourceName);
  if (!dataSource) {
    throw new Error(`FileMaker data source ${sourceName} not found in your ProofKit config`);
  }

  // Get existing schemas for this data source
  const existingSchemas = getExistingSchemas({
    projectDir,
    dataSourceName: sourceName,
  });

  if (existingSchemas.length === 0) {
    p.note(`No layouts found in data source "${sourceName}"`, "Nothing to remove");
    return;
  }

  // Show existing schemas and let user pick one to remove
  const schemaToRemove =
    opts?.schemaName ??
    abortIfCancel(
      await p.select({
        message: "Select a layout to remove",
        options: existingSchemas
          .map((schema) => ({
            label: `${schema.layout} (${schema.schemaName})`,
            value: schema.schemaName ?? "",
          }))
          .filter((opt) => opt.value !== ""),
      }),
    );

  // Confirm removal
  const confirmRemoval = await p.confirm({
    message: `Are you sure you want to remove the layout "${schemaToRemove}"?`,
    initialValue: false,
  });

  if (p.isCancel(confirmRemoval) || !confirmRemoval) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // Remove the schema
  await removeLayout({
    projectDir,
    dataSourceName: sourceName,
    schemaName: schemaToRemove,
    runCodegen: true,
  });

  p.outro(`Layout "${schemaToRemove}" has been removed from your project`);
};

export const makeRemoveSchemaCommand = () => {
  const removeSchemaCommand = new Command("layout")
    .alias("schema")
    .description("Remove a layout from your fmschema file")
    .action(async (opts: { settings: Settings }) => {
      const settings = opts.settings;
      await runRemoveSchemaAction({ settings });
    });

  return removeSchemaCommand;
};
