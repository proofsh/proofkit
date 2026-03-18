import DataApi, { type clientTypes, OttoAdapter, type OttoAPIKey } from "@proofkit/fmdapi";

export async function getLayouts({
  dataApiKey,
  fmFile,
  server,
}: {
  dataApiKey: OttoAPIKey;
  fmFile: string;
  server: string;
}) {
  const DapiClient = DataApi({
    adapter: new OttoAdapter({
      auth: { apiKey: dataApiKey },
      db: fmFile,
      server,
    }),
    layout: "",
  });

  const layoutsResp = await DapiClient.layouts();

  const layouts = transformLayoutList(layoutsResp.layouts);

  return layouts;
}

function getAllLayoutNames(layout: clientTypes.LayoutOrFolder): string[] {
  if ("isFolder" in layout) {
    return (layout.folderLayoutNames ?? []).flatMap(getAllLayoutNames);
  }
  return [layout.name];
}

export const commonFileMakerLayoutPrefixes = ["API_", "API ", "dapi_", "dapi"];

export function transformLayoutList(layouts: clientTypes.LayoutOrFolder[]): string[] {
  const flatList = layouts.flatMap(getAllLayoutNames);

  // sort the list so that any values that begin with one of the prefixes are at the top

  const sortedList = flatList.sort((a, b) => {
    const aPrefix = commonFileMakerLayoutPrefixes.find((prefix) => a.startsWith(prefix));
    const bPrefix = commonFileMakerLayoutPrefixes.find((prefix) => b.startsWith(prefix));
    if (aPrefix && bPrefix) {
      return a.localeCompare(b);
    }
    if (aPrefix) {
      return -1;
    }
    if (bPrefix) {
      return 1;
    }
    return a.localeCompare(b);
  });
  return sortedList;
}
