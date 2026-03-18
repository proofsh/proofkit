"use client";

import { __TYPE_NAME__ } from "@/config/schemas/__SOURCE_NAME__/__SCHEMA_NAME__";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import React from "react";

type TData = __TYPE_NAME__;

const columns: MRT_ColumnDef<TData>[] = [];

export default function MyTable({ data }: { data: TData[] }) {
  const table = useMantineReactTable({ data, columns });
  return <MantineReactTable table={table} />;
}
