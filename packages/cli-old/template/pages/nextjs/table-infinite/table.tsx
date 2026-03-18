"use client";

import { __TYPE_NAME__ } from "@/config/schemas/__SOURCE_NAME__/__SCHEMA_NAME__";
import { Text } from "@mantine/core";
import {
  createMRTColumnHelper,
  MantineReactTable,
  MRT_ColumnDef,
  MRT_ColumnFiltersState,
  MRT_RowVirtualizer,
  MRT_SortingState,
  useMantineReactTable,
} from "mantine-react-table";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type UIEvent,
} from "react";

import { useAllData } from "./query";

type TData = __TYPE_NAME__;

const columns: MRT_ColumnDef<TData>[] = [];

export default function MyTable() {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizerInstanceRef =
    useRef<MRT_RowVirtualizer<HTMLDivElement, HTMLTableRowElement>>(null);

  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    []
  );

  const {
    data,
    totalDBRowCount,
    totalFetched,
    isLoading,
    isFetching,
    fetchNextPage,
  } = useAllData({ sorting, columnFilters });

  const table = useMantineReactTable({
    data,
    columns,
    rowCount: totalDBRowCount,
    enableRowVirtualization: true, // only render the rows that are visible on screen to improve performance
    state: { isLoading, sorting, showProgressBars: isFetching, columnFilters },
    enableGlobalFilter: false, // doesn't work as easily with server-side filters, it's better to filter the specific columns
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    enablePagination: false, // hide pagination buttons
    enableStickyHeader: true,
    mantineBottomToolbarProps: { style: { alignItems: "center" } },
    renderBottomToolbarCustomActions: () =>
      !isLoading ? (
        <Text px="sm">
          Fetched {totalFetched} of {totalDBRowCount}
        </Text>
      ) : null,
    mantineTableContainerProps: ({ table }) => {
      return {
        h: table.getState().isFullScreen
          ? "100%"
          : `calc(100vh - var(--app-shell-header-height) - 10rem)`, // may need to adjust this height if you have more elements on your page
        ref: tableContainerRef,
        onScroll: (
          event: UIEvent<HTMLDivElement> //add an event listener to the table container element
        ) => fetchMoreOnBottomReached(event.target as HTMLDivElement),
      };
    },
  });

  // called on scroll and possibly on mount to fetch more data as the user scrolls and reaches bottom of table
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // once the user has scrolled within 400px of the bottom of the table, fetch more data
        if (
          scrollHeight - scrollTop - clientHeight < 400 &&
          !isFetching &&
          totalFetched < totalDBRowCount
        ) {
          void fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, totalFetched, totalDBRowCount]
  );

  // scroll to top of table when sorting or filters change
  useEffect(() => {
    if (rowVirtualizerInstanceRef.current) {
      try {
        rowVirtualizerInstanceRef.current.scrollToIndex(0);
      } catch (e) {
        console.error(e);
      }
    }
  }, [sorting, columnFilters]);

  return <MantineReactTable table={table} />;
}
