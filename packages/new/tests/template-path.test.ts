import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEMPLATE_ROOT } from "~/consts.js";

describe("shared template resolution", () => {
  it("resolves the browser scaffold template from the workspace layout", () => {
    expect(path.basename(TEMPLATE_ROOT)).toBe("template");
    expect(fs.existsSync(path.join(TEMPLATE_ROOT, "nextjs-shadcn"))).toBe(true);
  });
});
