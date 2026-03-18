import { __CLIENT_NAME__ } from "@/config/schemas/__SOURCE_NAME__/client";
import { Stack } from "@mantine/core";
import React from "react";

import TableContent from "./table";

export default async function TablePage() {
  // this function is limited to 100 records by default. To load more, see the other table templates from the docs
  const { data } = await __CLIENT_NAME__.list({
    fetch: { next: { revalidate: 60 } }, // only call the database at most once every 60 seconds
  });
  return (
    <Stack>
      <TableContent data={data.map((d) => d.fieldData)} />
    </Stack>
  );
}
