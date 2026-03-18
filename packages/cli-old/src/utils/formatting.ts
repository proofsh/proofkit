import { execa } from "execa";
import type { Project } from "ts-morph";

import { state } from "~/state.js";

/**
 * Formats all source files in a ts-morph Project using biome and saves the changes.
 * @param project The ts-morph Project containing the files to format
 */
export async function formatAndSaveSourceFiles(project: Project) {
  await project.save(); // save files first
  try {
    // Run biome format on the project directory
    await execa("npx", ["@biomejs/biome", "format", "--write", state.projectDir], {
      cwd: state.projectDir,
    });
  } catch (error) {
    if (state.debug) {
      console.log("Error formatting files with biome");
      console.error(error);
    }
    // Continue even if formatting fails
  }
}
