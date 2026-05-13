import { handleDownload } from "../../_lib";

export const GET = async (request: Request, { params }: { params: Promise<{ platform: string; version: string }> }) => {
  const { platform, version } = await params;
  return handleDownload({ platform, version }, request);
};
