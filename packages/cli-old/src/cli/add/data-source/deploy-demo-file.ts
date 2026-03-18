import { createDataAPIKeyWithCredentials, getDeploymentStatus, startDeployment } from "~/cli/ottofms.js";
import * as p from "~/cli/prompts.js";

export const filename = "ProofKitDemo.fmp12";

export async function deployDemoFile({
  url,
  token,
  operation,
}: {
  url: URL;
  token: string;
  operation: "install" | "replace";
}): Promise<{ apiKey: string }> {
  const deploymentJSON = {
    scheduled: false,
    label: "Install ProofKit Demo",
    deployments: [
      {
        name: "Install ProofKit Demo",
        source: {
          type: "url",
          url: "https://proofkit.dev/proofkit-demo/manifest.json",
        },
        fileOperations: [
          {
            target: {
              fileName: filename,
            },
            operation,
            source: {
              fileName: "ProofKitDemo.fmp12",
            },
            location: {
              folder: "default",
              subFolder: "",
            },
          },
        ],
        concurrency: 1,
        options: {
          closeFilesAfterBuild: false,
          keepFilesClosedAfterComplete: false,
          transferContainerData: false,
        },
      },
    ],
    abortRemaining: false,
  };

  const spinner = p.spinner();
  spinner.start("Deploying ProofKit Demo file...");

  const {
    response: { subDeploymentIds },
  } = await startDeployment({
    payload: deploymentJSON,
    url,
    token,
  });

  const deploymentId = subDeploymentIds[0];
  if (!deploymentId) {
    throw new Error("No deployment ID returned from the server");
  }

  while (true) {
    // wait 2.5 seconds, then poll the status again
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const {
      response: { status, running },
    } = await getDeploymentStatus({
      url,
      token,
      deploymentId,
    });
    if (!running) {
      if (status !== "complete") {
        throw new Error("Deployment didn't complete");
      }
      break;
    }
  }

  const { apiKey } = await createDataAPIKeyWithCredentials({
    filename,
    username: "admin",
    password: "admin",
    url,
  });

  spinner.stop();

  return { apiKey };
}
