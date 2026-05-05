export function getNodeMajorVersion() {
  return process.versions.node.split(".")[0] ?? "22";
}
