import path from "node:path";
import fs from "fs-extra";
import { z } from "zod/v4";

import { state } from "~/state.js";

const authSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("clerk"),
    }),
    z.object({
      type: z.literal("next-auth"),
    }),
    z.object({
      type: z.literal("proofkit").transform(() => "fmaddon"),
    }),
    z.object({
      type: z.literal("fmaddon"),
    }),
    z.object({
      type: z.literal("better-auth"),
    }),
    z.object({
      type: z.literal("none"),
    }),
  ])
  .default({ type: "none" });

export const envNamesSchema = z.object({
  database: z.string().default("FM_DATABASE"),
  server: z.string().default("FM_SERVER"),
  apiKey: z.string().default("OTTO_API_KEY"),
});
export const dataSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fm"),
    name: z.string(),
    envNames: envNamesSchema,
  }),
  z.object({
    type: z.literal("supabase"),
    name: z.string(),
  }),
]);
export type DataSource = z.infer<typeof dataSourceSchema>;

export const appTypes = ["browser", "webviewer"] as const;

export const uiTypes = ["shadcn", "mantine"] as const;
export type Ui = (typeof uiTypes)[number];

const settingsSchema = z.discriminatedUnion("ui", [
  z.object({
    ui: z.literal("mantine"),
    appType: z.enum(appTypes).default("browser"),
    auth: authSchema,
    envFile: z.string().optional(),
    dataSources: z.array(dataSourceSchema).default([]),
    tanstackQuery: z.boolean().catch(false),
    replacedMainPage: z.boolean().catch(false),
    // Whether React Email scaffolding has been installed
    reactEmail: z.boolean().catch(false),
    // Whether provider-specific server email sender files have been installed
    reactEmailServer: z.boolean().catch(false),
    appliedUpgrades: z.array(z.string()).default([]),
    registryUrl: z.url().optional(),
    registryTemplates: z.array(z.string()).default([]),
  }),
  z.object({
    ui: z.literal("shadcn"),
    appType: z.enum(appTypes).default("browser"),
    envFile: z.string().optional(),
    dataSources: z.array(dataSourceSchema).default([]),
    replacedMainPage: z.boolean().catch(false),
    registryUrl: z.url().optional(),
    registryTemplates: z.array(z.string()).default([]),
  }),
]);

export const defaultSettings = settingsSchema.parse({
  auth: { type: "none" },
  ui: "shadcn",
  appType: "browser",
  dataSources: [],
  replacedMainPage: false,
  registryTemplates: [],
});

let settings: Settings | undefined;
export const getSettings = () => {
  if (settings) {
    return settings;
  }

  const settingsPath = path.join(state.projectDir, "proofkit.json");

  // Check if the settings file exists before trying to read it
  if (!fs.existsSync(settingsPath)) {
    throw new Error(`ProofKit settings file not found at: ${settingsPath}`);
  }

  let settingsFile: unknown = fs.readJSONSync(settingsPath);

  if (typeof settingsFile === "object" && settingsFile !== null && !("ui" in settingsFile)) {
    settingsFile = { ...settingsFile, ui: "mantine" };
  }

  const parsed = settingsSchema.parse(settingsFile);

  state.appType = parsed.appType;
  return parsed;
};

export type Settings = z.infer<typeof settingsSchema>;

export function mergeSettings(_settings: Partial<Settings>) {
  const settings = getSettings();
  const merged = { ...settings, ..._settings };
  const validated = settingsSchema.parse(merged);
  setSettings(validated);
}

export function setSettings(_settings: Settings) {
  fs.writeJSONSync(path.join(state.projectDir, "proofkit.json"), _settings, {
    spaces: 2,
  });
  settings = _settings;
  return settings;
}

/**
 * Validates and sets the envFile in settings only if the file exists.
 * Used during stealth initialization to avoid setting non-existent env files.
 */
export function validateAndSetEnvFile(envFileName = ".env") {
  const settings = getSettings();
  const envFilePath = path.join(state.projectDir, envFileName);

  if (fs.existsSync(envFilePath)) {
    const updatedSettings = { ...settings, envFile: envFileName };
    setSettings(updatedSettings);
    return envFileName;
  }

  // If no env file exists, ensure envFile is undefined in settings
  if (settings.envFile) {
    const { envFile, ...settingsWithoutEnvFile } = settings;
    setSettings(settingsWithoutEnvFile as Settings);
  }

  return undefined;
}
