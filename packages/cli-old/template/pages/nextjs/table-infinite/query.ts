"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  MRT_ColumnFiltersState,
  MRT_SortingState,
} from "mantine-react-table";
import { useMemo } from "react";

import { fetchData } from "./actions";

export function useAllData({
  sorting,
  columnFilters,
}: {
  sorting: MRT_SortingState;
  columnFilters: MRT_ColumnFiltersState;
}) {
  // useInfiniteQuery is used to help with automatic pagination
  const qr = useInfiniteQuery({
    queryKey: ["all-__SCHEMA_NAME__", sorting, columnFilters],
    queryFn: async ({ pageParam: offset }) => {
      const result = await fetchData({ offset, sorting, columnFilters });
      if (!result) throw new Error(`Failed to fetch __SCHEMA_NAME__`);
      if (!result.data) throw new Error(`No data found for __SCHEMA_NAME__`);
      return result?.data;
    },
    retry: false,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasNextPage
        ? pages.flatMap((page) => page.data).length
        : undefined,
  });

  const flatData = useMemo(
    () =>
      qr.data?.pages.flatMap((page) => page.data).map((o) => o.fieldData) ?? [],
    [qr.data]
  );
  const totalFetched = flatData.length;
  const totalDBRowCount = qr.data?.pages?.[0]?.totalCount ?? 0;

  return { ...qr, data: flatData, totalDBRowCount, totalFetched };
}
