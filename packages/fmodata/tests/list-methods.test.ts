import { MockFMServerConnection } from "@proofkit/fmodata/testing";
import { beforeEach, describe, it } from "vitest";
import { users } from "./utils/test-setup";

const DB_NAME = "test_db";
let db: ReturnType<MockFMServerConnection["database"]>;

beforeEach(() => {
  const mock = new MockFMServerConnection();
  mock.addRoute({ urlPattern: DB_NAME, response: { value: [] } });
  db = mock.database(DB_NAME);
});

describe("list methods", () => {
  it("should not run query unless you await the method", async () => {
    const { data: _data, error: _error } = await db
      .from(users)
      .list()
      .select({ CreatedBy: users.CreatedBy, active: users.active })
      .execute();
  });
});
