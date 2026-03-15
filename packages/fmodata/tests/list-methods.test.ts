import { describe, it } from "vitest";
import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { users } from "./utils/test-setup";

const mock = new MockFMServerConnection();
mock.addRoute({ urlPattern: "test.fmp12", response: { value: [] } });
const db = mock.database("test_db");

describe("list methods", () => {
  it("should not run query unless you await the method", async () => {
    const { data: _data, error: _error } = await db
      .from(users)
      .list()
      .select({ CreatedBy: users.CreatedBy, active: users.active })
      .execute();
  });
});
