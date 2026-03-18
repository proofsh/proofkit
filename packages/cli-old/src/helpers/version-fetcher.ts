import https from "node:https";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import z from "zod/v4";

export async function fetchServerVersions({ url, ottoPort = 3030 }: { url: string; ottoPort?: number }) {
  const fmsInfo = await fetchFMSVersionInfo(url);
  const ottoInfo = await fetchOttoVersion({ url, ottoPort });
  return { fmsInfo, ottoInfo };
}

const fmsInfoSchema = z.object({
  data: z.object({
    APIVersion: z.number().optional(),
    AcceptEARPassword: z.boolean().optional(),
    AcceptEncrypted: z.boolean().optional(),
    AcceptUnencrypted: z.boolean().optional(),
    AdminLocalAuth: z.string().optional(),
    AllowChangeUploadDBFolder: z.boolean().optional(),
    AutoOpenForUpload: z.boolean().optional(),
    DenyGuestAndAutoLogin: z.string().optional(),
    Hostname: z.string().optional(),
    IsAppleInternal: z.boolean().optional(),
    IsETS: z.boolean().optional(),
    PremisesType: z.string().optional(),
    ProductVersion: z.string().optional(),
    PublicKey: z.string().optional(),
    RequiresDBPasswords: z.boolean().optional(),
    ServerID: z.string().optional(),
    ServerVersion: z.string(),
  }),
  result: z.number(),
});

export async function fetchFMSVersionInfo(url: string) {
  const fmsUrl = new URL(url);
  fmsUrl.pathname = "/fmws/serverinfo";

  const fmsInfoResult = await fetchWithoutSSL(fmsUrl.toString()).then((r) => fmsInfoSchema.safeParse(r.data));
  if (!fmsInfoResult.success) {
    console.error("fmsInfoResult.error", fmsInfoResult.error.issues);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid FileMaker Server URL",
    });
  }
  return fmsInfoResult.data.data;
}

const ottoInfoSchema = z.object({
  Otto: z.object({
    version: z.string(),
    serverNickname: z.string().default(""),
    isLicenseValid: z.boolean().optional(),
  }),
  migratorVersion: z.string().optional(),
  FileMakerServer: z.object({
    version: z.object({
      long: z.string(),
      short: z.string(),
    }),
    running: z.boolean().optional(),
  }),
  isMac: z.boolean().optional(),
  platform: z.string().optional(),
  host: z.string().optional(),
});

const ottoInfoResponseSchema = z.object({
  response: ottoInfoSchema,
});

export async function fetchOttoVersion({
  url,
  ottoPort = 3030,
}: {
  url: string;
  ottoPort?: number | null;
}): Promise<z.infer<typeof ottoInfoSchema> | null> {
  let ottoInfo = await fetchOtto4Version(url);
  if (!ottoInfo) {
    ottoInfo = await fetchOtto3Version(url, ottoPort);
  }
  return ottoInfo;
}

async function fetchOtto4Version(url: string) {
  try {
    const otto4Url = new URL(url);
    otto4Url.pathname = "/otto/api/info";
    const otto4Info = await fetchWithoutSSL(otto4Url.toString()).then((r) => {
      return ottoInfoResponseSchema.parse(r.data).response;
    });
    return otto4Info;
  } catch (_error) {
    console.log("unable to fetch otto4 info, trying otto3");
    return null;
  }
}

async function fetchOtto3Version(url: string, ottoPort: number | null) {
  try {
    const otto3Url = new URL(url);
    otto3Url.port = ottoPort ? ottoPort.toString() : "3030";
    otto3Url.pathname = "/api/otto/info";
    const ottoInfo = await fetchWithoutSSL(otto3Url.toString()).then((res) => {
      return ottoInfoSchema.parse(res.data);
    });
    return ottoInfo;
  } catch (error) {
    if (error instanceof Error) {
      console.error("otto3 fetch error", error.message);
    }
    return null;
  }
}

async function fetchWithoutSSL(url: string) {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  const result = await axios.get(url, {
    validateStatus: null,
    headers: { Connection: "close" },
    httpsAgent: agent,
    timeout: 10_000,
  });

  return result;
}
