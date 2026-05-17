import { describe, expect, it } from "vitest";
import { getFriendlyTypegenError } from "../src/cli-errors";

describe("getFriendlyTypegenError", () => {
  it("formats FileMaker authorization denial without a stack trace", () => {
    const error = new Error('Not authorized to connect to FileMaker file "Foxtail_Demo": authorization rejected');

    expect(getFriendlyTypegenError(error)).toMatchInlineSnapshot(`
      "FileMaker authorization denied.
      Not authorized to connect to FileMaker file "Foxtail_Demo": authorization rejected
      Open FileMaker and approve the connection request, then run typegen again."
    `);
  });

  it("ignores unrelated errors", () => {
    expect(getFriendlyTypegenError(new Error("Unexpected failure"))).toBeUndefined();
  });
});
