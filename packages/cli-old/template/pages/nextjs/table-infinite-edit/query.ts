"use client";

import { showErrorNotification } from "@/utils/notification-helpers";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  MRT_ColumnFiltersState,
  MRT_SortingState,
} from "mantine-react-table";
import { useMemo } from "react";

import { fetchData, updateRecord } from "./actions";
import { idFieldName } from "./schema";

export function useAllData({
  sorting,
  columnFilters,
}: {
  sorting: MRT_SortingState;
  columnFilters: MRT_ColumnFiltersState;
}) {
  const queryKey = ["all-__SCHEMA_NAME__", sorting, columnFilters];
  // useInfiniteQuery is used to help with automatic pagination
  const qr = useInfiniteQuery({
    queryKey,
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

  const queryClient = useQueryClient();

  const updateRecordMutation = useMutation({
    mutationFn: updateRecord,
    onMutate: async (newRecord) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Optimistically update to the new value
      queryClient.setQueryData<typeof qr.data>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((row) =>
              row.fieldData[idFieldName] === newRecord[idFieldName]
                ? { ...row, fieldData: { ...row.fieldData, ...newRecord } }
                : row
            ),
          })),
        };
      });
    },
    onError: () => {
      showErrorNotification("Failed to update record");
    },
  });

  return {
    ...qr,
    data: flatData,
    totalDBRowCount,
    totalFetched,
    updateRecord: updateRecordMutation.mutate,
  };
}
