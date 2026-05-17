const fmMcpAuthorizationPrefix = "Not authorized to connect to FileMaker file ";

export function getFriendlyTypegenError(error: unknown): string | undefined {
  if (!(error instanceof Error && error.message.startsWith(fmMcpAuthorizationPrefix))) {
    return undefined;
  }

  return [
    "FileMaker authorization denied.",
    error.message,
    "Open FileMaker and approve the connection request, then run typegen again.",
  ].join("\n");
}
