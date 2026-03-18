"use client";

import { type __TYPE_NAME__ } from "@/config/schemas/__SOURCE_NAME__/__SCHEMA_NAME__";
import { showErrorNotification } from "@/utils/notification-helpers";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_Cell,
  type MRT_ColumnDef,
} from "mantine-react-table";
import React from "react";

import { updateRecord } from "./actions";
import { idFieldName } from "./schema";

type TData = __TYPE_NAME__;

const columns: MRT_ColumnDef<TData>[] = [];

async function handleSaveCell(cell: MRT_Cell<TData>, value: unknown) {
  const resp = await updateRecord({
    [idFieldName]: cell.row.id,
    [cell.column.id]: value,
  });
  if (!resp?.data) {
    showErrorNotification("Failed to update record");
  }
}

export default function MyTable({ data }: { data: TData[] }) {
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
  return <MantineReactTable table={table} />;
}
