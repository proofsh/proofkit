const ROOT_KEY_ORDER = [
  "name",
  "version",
  "private",
  "description",
  "keywords",
  "homepage",
  "bugs",
  "repository",
  "license",
  "author",
  "contributors",
  "funding",
  "type",
  "packageManager",
  "devEngines",
  "engines",
  "bin",
  "exports",
  "main",
  "module",
  "types",
  "files",
  "scripts",
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "optionalDependencies",
  "bundledDependencies",
  "resolutions",
  "overrides",
  "pnpm",
  "lint-staged",
] as const;

const ROOT_KEY_POSITION = new Map<string, number>(ROOT_KEY_ORDER.map((key, index) => [key, index]));
const SORTED_OBJECT_KEYS = new Set<string>([
  "scripts",
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "optionalDependencies",
  "bundledDependencies",
  "resolutions",
  "overrides",
]);

function compareRootKeys(left: string, right: string) {
  const leftIndex = ROOT_KEY_POSITION.get(left);
  const rightIndex = ROOT_KEY_POSITION.get(right);

  if (leftIndex !== undefined && rightIndex !== undefined) {
    return leftIndex - rightIndex;
  }

  if (leftIndex !== undefined) {
    return -1;
  }

  if (rightIndex !== undefined) {
    return 1;
  }

  return left.localeCompare(right);
}

function sortRecord(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

export function sortPackageJson<T extends Record<string, unknown>>(packageJson: T): T {
  const sortedEntries = Object.entries(packageJson).sort(([left], [right]) => compareRootKeys(left, right));
  const sortedPackageJson = Object.fromEntries(
    sortedEntries.map(([key, value]) => {
      if (SORTED_OBJECT_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
        return [key, sortRecord(value as Record<string, unknown>)];
      }

      return [key, value];
    }),
  );

  return sortedPackageJson as T;
}
