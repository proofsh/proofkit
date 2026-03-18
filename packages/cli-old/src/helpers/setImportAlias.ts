import { replaceTextInFiles } from "./replaceText.js";

const TRAILING_SLASH_REGEX = /[^/]$/;

export const setImportAlias = (projectDir: string, importAlias: string) => {
  const normalizedImportAlias = importAlias
    .replace(/\*/g, "") // remove any wildcards (~/* -> ~/)
    .replace(TRAILING_SLASH_REGEX, "$&/"); // ensure trailing slash (@ -> ~/)

  // update import alias in any files if not using the default
  replaceTextInFiles(projectDir, "~/", normalizedImportAlias);
};
