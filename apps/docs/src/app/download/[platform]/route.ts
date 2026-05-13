import { handleDownload } from "../_lib";

export const GET = async (request: Request, { params }: { params: Promise<{ platform: string }> }) => {
  const { platform } = await params;
  return handleDownload({ platform }, request);
};
