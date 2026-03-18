"use server";

import { __ZOD_TYPE_NAME__ } from "@/config/schemas/__SOURCE_NAME__/__SCHEMA_NAME__";
import { __CLIENT_NAME__ } from "@/config/schemas/__SOURCE_NAME__/client";
import { __ACTION_CLIENT__ } from "@/server/safe-action";

import { idFieldName } from "./schema";

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
