import { Effect } from "effect";
import { PackageManagerService, TemplateService } from "~/core/context.js";
import { executeInitPlan } from "~/core/executeInitPlan.js";
import { planInit } from "~/core/planInit.js";
import { resolveInitRequest } from "~/core/resolveInitRequest.js";
import type { CliFlags, InitResult } from "~/core/types.js";

export const runInit = (name?: string, flags?: CliFlags) =>
  Effect.gen(function* () {
    const templateService = yield* TemplateService;
    const packageManagerService = yield* PackageManagerService;

    const request = yield* resolveInitRequest(name, flags);
    const templateDir = templateService.getTemplateDir(request.appType, request.ui);
    const packageManagerVersion = yield* Effect.promise(() =>
      packageManagerService.getVersion(request.packageManager, request.cwd),
    );
    const plan = planInit(request, { templateDir, packageManagerVersion });

    yield* executeInitPlan(plan);

    return {
      request,
      plan,
    } satisfies InitResult;
  });
