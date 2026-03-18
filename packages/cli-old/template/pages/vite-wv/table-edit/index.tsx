import FullScreenLoader from "@/components/full-screen-loader";
import { __TYPE_NAME__ } from "@/config/schemas/__SOURCE_NAME__/__SCHEMA_NAME__";
import { __CLIENT_NAME__ } from "@/config/schemas/__SOURCE_NAME__/client";
import { Code, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import {
  MantineReactTable,
  MRT_Cell,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  pendingComponent: () => <FullScreenLoader />,
  loader: async () => {
    // this function is limited to 100 records by default. To load more, see the other table templates from the docs
    const { data } = await __CLIENT_NAME__.list();
    return data.map((record) => record.fieldData) as __TYPE_NAME__[];
  },
});

type TData = __TYPE_NAME__;

const columns: MRT_ColumnDef<TData>[] = [];

// TODO: Make sure this variable is properly set to your primary key field
const idFieldName: keyof __TYPE_NAME__ = "__FIRST_FIELD_NAME__";
async function handleSaveCell(cell: MRT_Cell<TData>, value: unknown) {
  const {
    data: { recordId },
  } = await __CLIENT_NAME__.findOne({
    query: { [idFieldName]: `==${cell.row.id}` },
  });

  await __CLIENT_NAME__.update({
    fieldData: { [cell.column.id]: value },
    recordId,
  });
}

function RouteComponent() {
  const data = Route.useLoaderData();
  const table = useMantineReactTable({
    data,
    columns,
    enableEditing: true,
    editDisplayMode: "cell",
    getRowId: (row) => row[idFieldName],
    mantineEditTextInputProps: ({ cell }) => ({
      //onBlur is more efficient, but could use onChange instead
      onBlur: (event) => {
        handleSaveCell(cell, event.target.value);
      },
    }),
  });
  return (
    <Stack p="md">
      <div>
        <Text>
          This table allows editing. Double-click on a cell to edit the value.
        </Text>
        <Text size="sm" c="dimmed">
          NOTE: This feature requires a primary key field on your API layout. If
          your primary key field is not <Code>{idFieldName}</Code>, update the
          <Code>idFieldName</Code> variable in the code.
        </Text>
      </div>
      <MantineReactTable table={table} />
    </Stack>
  );
}
