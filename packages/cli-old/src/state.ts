import { z } from "zod/v4";

const schema = z
  .object({
    ci: z.boolean().default(false),
    nonInteractive: z.boolean().default(false),
    debug: z.boolean().default(false),
    localBuild: z.boolean().default(false),
    baseCommand: z.enum(["add", "init", "deploy", "upgrade", "remove"]).optional().catch(undefined),
    appType: z.enum(["browser", "webviewer"]).optional().catch(undefined),
    ui: z.enum(["shadcn", "mantine"]).optional().catch("mantine"),
    projectDir: z.string().default(process.cwd()),
    authType: z.enum(["clerk", "fmaddon"]).optional(),
    emailProvider: z.enum(["plunk", "resend", "none"]).optional(),
    dataSource: z.enum(["filemaker", "none"]).optional(),
  })
  .passthrough();

type ProgramState = z.infer<typeof schema>;
export let state: ProgramState = schema.parse({});

export function initProgramState(args: unknown) {
  const parsed = schema.safeParse(args);
  if (parsed.success) {
    const mergedState = { ...state, ...parsed.data };
    const nonInteractive = mergedState.nonInteractive || mergedState.ci;
    state = { ...mergedState, ci: nonInteractive, nonInteractive };
  }
}

export function isNonInteractiveMode() {
  return state.nonInteractive || state.ci;
}
