"use server";

import {
  __TYPE_NAME__,
  __ZOD_TYPE_NAME__,
} from "@/config/schemas/__SOURCE_NAME__/__SCHEMA_NAME__";
import { __CLIENT_NAME__ } from "@/config/schemas/__SOURCE_NAME__/client";
import { __ACTION_CLIENT__ } from "@/server/safe-action";
import { clientTypes } from "@proofkit/fmdapi";
import dayjs from "dayjs";
import { z } from "zod/v4";

import { idFieldName } from "./schema";

const limit = 50; // raise or lower this number depending on how your layout performs
export const fetchData = __ACTION_CLIENT__
  .inputSchema(
    z.object({
      offset: z.number().catch(0),
      sorting: z.array(
        z.object({ id: z.string(), desc: z.boolean().default(false) })
      ),
      columnFilters: z.array(z.object({ id: z.string(), value: z.unknown() })),
    })
  )
  .action(async ({ parsedInput: { offset, sorting, columnFilters } }) => {

    const getOptions: clientTypes.ListParams<__TYPE_NAME__, any> & {
      query: clientTypes.Query<__TYPE_NAME__>[];
    } = {
      limit,
      offset,
      query: [{ ["__FIRST_FIELD_NAME__"]: "*" }],
    };

    if (sorting.length > 0) {
      getOptions.sort = sorting.map(({ id, desc }) => ({
        fieldName: id as keyof __TYPE_NAME__,
        sortOrder: desc ? "descend" : "ascend",
      }));
    }

    if (columnFilters.length > 0) {
      getOptions.query = columnFilters
        .map(({ id, value }) => {
          if (typeof value === "string") {
            return {
              [id]: value,
            };
          } else if (typeof value === "object" && value instanceof Date) {
            return {
              [id]: dayjs(value).format("YYYY+MM+DD"),
            };
          }
          return null;
        })
        .filter(Boolean) as clientTypes.Query<any>[];
    }

    const data = await __CLIENT_NAME__.find(getOptions);

    return {
      data: data.data,
      hasNextPage: data.dataInfo.foundCount > limit + offset,
      totalCount: data.dataInfo.foundCount,
    };
  });

export const updateRecord = __ACTION_CLIENT__
  .inputSchema(__ZOD_TYPE_NAME__.partial())
  .action(async ({ parsedInput }) => {
    const id = parsedInput[idFieldName];
    delete parsedInput[idFieldName]; // this ensures the id field value is not included in the updated fieldData
    const data = parsedInput;

    const {
      data: { recordId },
    } = await __CLIENT_NAME__.findOne({ query: { [idFieldName]: `==${id}` } });

    return await __CLIENT_NAME__.update({
      recordId,
      fieldData: data,
    });
  });
