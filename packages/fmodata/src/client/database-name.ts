const FMP12_EXT_REGEX = /\.fmp12$/i;

export type DatabaseNameNormalizationMode = "default" | "ensureExtension";

export function stripFmp12Extension(databaseName: string): string {
  return databaseName.replace(FMP12_EXT_REGEX, "");
}

export function ensureFmp12Extension(databaseName: string): string {
  return FMP12_EXT_REGEX.test(databaseName) ? databaseName : `${databaseName}.fmp12`;
}

export function normalizeDatabaseSegment(
  databaseName: string,
  normalizeDatabaseName: boolean,
  mode: DatabaseNameNormalizationMode = "default",
): string {
  if (!normalizeDatabaseName) {
    return databaseName;
  }

  return mode === "ensureExtension" ? ensureFmp12Extension(databaseName) : stripFmp12Extension(databaseName);
}

export function normalizeDatabasePath(
  path: string,
  options: {
    normalizeDatabaseName: boolean;
    mode?: DatabaseNameNormalizationMode;
  },
): string {
  if (!path.startsWith("/")) {
    return path;
  }

  const secondSlashIndex = path.indexOf("/", 1);
  const hasDatabaseSegment = secondSlashIndex !== -1;
  const databaseSegment = hasDatabaseSegment ? path.slice(1, secondSlashIndex) : path.slice(1);

  if (!databaseSegment || databaseSegment.startsWith("$")) {
    return path;
  }

  const normalizedDatabaseSegment = normalizeDatabaseSegment(
    decodeURIComponent(databaseSegment),
    options.normalizeDatabaseName,
    options.mode,
  );

  const encodedDatabaseSegment = encodeURIComponent(normalizedDatabaseSegment);
  return hasDatabaseSegment
    ? `/${encodedDatabaseSegment}${path.slice(secondSlashIndex)}`
    : `/${encodedDatabaseSegment}`;
}
