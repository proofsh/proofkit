import { Code, Stack, Text } from "@mantine/core";
import React from "react";

import { idFieldName } from "./schema";
import TableContent from "./table";

export default async function TablePage() {
  return (
    <Stack>
      <div>
        <Text>
          This table allows editing. Double-click on a cell to edit the value.
        </Text>
        <Text size="sm" c="dimmed">
          NOTE: This feature requires a primary key field on your API layout. If
          your primary key field is not <Code>{idFieldName}</Code>, update the
          <Code>idFieldName</Code> variable in the <Code>schema.ts</Code> file.
        </Text>
      </div>
      <TableContent />
    </Stack>
  );
}
