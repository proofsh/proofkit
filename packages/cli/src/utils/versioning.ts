export function getProofkitReleaseTag() {
  return "beta";
}

export function getNodeMajorVersion() {
  return process.versions.node.split(".")[0] ?? "22";
}
