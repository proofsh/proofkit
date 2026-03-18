import axios, { AxiosError } from "axios";
import chalk from "chalk";
import open from "open";
import randomstring from "randomstring";
import { z } from "zod/v4";

import * as clack from "~/cli/prompts.js";
import { abortIfCancel } from "./utils.js";

interface WizardResponse {
  token: string;
}
export async function getOttoFMSToken({ url }: { url: URL }): Promise<{ token: string }> {
  // generate a random string
  const hash = randomstring.generate({ length: 18, charset: "alphanumeric" });

  const loginUrl = new URL(`/otto/wizard/${hash}`, url.origin);

  const urlToOpen = loginUrl.toString();
  clack.log.info(
    `${chalk.bold(
      `If the browser window didn't open automatically, please open the following link to login into your OttoFMS server:`,
    )}\n\n${chalk.cyan(urlToOpen)}`,
  );

  open(loginUrl.toString()).catch(() => {
    // Ignore errors from open() - the user can manually open the URL
  });

  const loginSpinner = clack.spinner();

  loginSpinner.start("Waiting for you to log in using the link above");

  const data = await new Promise<WizardResponse>((resolve) => {
    const pollingInterval = setInterval(() => {
      axios
        .get<{ response: WizardResponse }>(`${url.origin}/otto/api/cli/checkHash/${hash}`, {
          headers: {
            "Accept-Encoding": "deflate",
          },
        })
        .then((result) => {
          resolve(result.data.response);
          clearTimeout(timeout);
          clearInterval(pollingInterval);
          axios
            .delete(`${url.origin}/otto/api/cli/checkHash/${hash}`, {
              headers: {
                "Accept-Encoding": "deflate",
              },
            })
            .catch(() => {
              // Ignore cleanup errors
            });
        })
        .catch(() => {
          // noop - just try again
        });
    }, 500);

    const timeout = setTimeout(() => {
      clearInterval(pollingInterval);
      loginSpinner.stop("Login timed out. No worries - it happens to the best of us.");
    }, 180_000); // 3 minutes
  });
  // clack.log.info(`Token: ${JSON.stringify(data)}`);

  loginSpinner.stop("Login complete.");

  return data;
}

interface ListFilesResponse {
  response: {
    databases: {
      clients: number;
      decryptHint: string;
      enabledExtPrivileges: string[];
      filename: string;
      folder: string;
      hasSavedDecryptKey: boolean;
      id: string;
      isEncrypted: boolean;
      size: number;
      status: string;
    }[];
  };
}

export async function listFiles({ url, token }: { url: URL; token: string }) {
  const response = await axios.get<ListFilesResponse>(`${url.origin}/otto/fmi/admin/api/v2/databases`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.response.databases;
}

interface ListAPIKeysResponse {
  response: {
    "api-keys": {
      id: number;
      key: string;
      token: string;
      user: string;
      database: string;
      label: string;
      created_at: string;
      updated_at: string;
    }[];
  };
}

export async function listAPIKeys({ url, token }: { url: URL; token: string }) {
  const response = await axios.get<ListAPIKeysResponse>(`${url.origin}/otto/api/api-key`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.response["api-keys"];
}

interface CreateAPIKeyResponse {
  response: {
    key: string;
    token: string;
  };
}
export async function createDataAPIKey({ url, filename }: { url: URL; filename: string }) {
  clack.log.info(
    `${chalk.cyan("Creating a Data API Key")}\nEnter FileMaker credentials for ${chalk.bold(filename)}.\n${chalk.dim("The account must have the fmrest extended privilege enabled.")}`,
  );

  while (true) {
    const username = abortIfCancel(
      await clack.text({
        message: `Enter the account name for ${chalk.bold(filename)}`,
      }),
    );

    const password = abortIfCancel(
      await clack.password({
        message: `Enter the password for ${chalk.bold(username)}`,
      }),
    );

    try {
      const response = await createDataAPIKeyWithCredentials({
        url,
        filename,
        username,
        password,
      });

      return response;
    } catch (error) {
      if (error instanceof AxiosError) {
        const respMsg =
          error.response?.data && "messages" in error.response.data
            ? (error.response.data as { messages?: { text?: string }[] }).messages?.[0]?.text
            : undefined;

        clack.log.error(
          `${chalk.red("Error creating Data API key:")} ${respMsg ?? `Error code ${error.response?.status}`}
${chalk.dim(
  error.response?.status === 400 &&
    `Common reasons this might happen:
- The provided credentials are incorrect.
- The account does not have the fmrest extended privilege enabled.

You may also want to try to create an API directly in the OttoFMS dashboard:
${url.origin}/otto/app/api-keys`,
)}
        `,
        );
      } else {
        clack.log.error(`${chalk.red("Error creating Data API key:")} Unknown error`);
      }
      const tryAgain = abortIfCancel(
        await clack.confirm({
          message: "Do you want to try and enter credentials again?",
        }),
      );
      if (!tryAgain) {
        throw new Error("User cancelled");
      }
    }
  }
}

export async function createDataAPIKeyWithCredentials({
  url,
  filename,
  username,
  password,
}: {
  url: URL;
  filename: string;
  username: string;
  password: string;
}) {
  const response = await axios.post<CreateAPIKeyResponse>(`${url.origin}/otto/api/api-key/create-only`, {
    database: filename,
    label: "For FM Web App",
    user: username,
    pass: password,
  });

  return { apiKey: response.data.response.key };
}

export async function startDeployment({ payload, url, token }: { payload: unknown; url: URL; token: string }) {
  const responseSchema = z.object({
    response: z.object({
      started: z.boolean(),
      batchId: z.number(),
      subDeploymentIds: z.array(z.number()),
    }),
    messages: z.array(z.object({ code: z.number(), text: z.string() })),
  });

  const response = await axios
    .post(`${url.origin}/otto/api/deployment`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .catch((error) => {
      console.error(error.response.data);
      throw error;
    });

  return responseSchema.parse(response.data);
}

export async function getDeploymentStatus({
  url,
  token,
  deploymentId,
}: {
  url: URL;
  token: string;
  deploymentId: number;
}) {
  const schema = z.object({
    response: z.object({
      id: z.number(),
      status: z.enum(["queued", "running", "scheduled", "complete", "aborted", "unknown"]),
      running: z.coerce.boolean(),
      created_at: z.string(),
      started_at: z.string(),
      updated_at: z.string(),
    }),
    messages: z.array(z.object({ code: z.number(), text: z.string() })),
  });

  const response = await axios.get(`${url.origin}/otto/api/deployment/${deploymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return schema.parse(response.data);
}
