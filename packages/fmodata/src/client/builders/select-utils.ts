import type { FMTable } from "../../orm/table";
import { transformFieldNamesArray } from "../../transform";

const VALID_FIELD_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Determines if a field name needs to be quoted in OData queries.
 * Per FileMaker docs: field names with special characters (spaces, underscores, etc.) must be quoted.
 * Also quotes "id"/"ID" as it's an OData reserved word.
 * Entity IDs (FMFID:*, FMTID:*) are not quoted as they're identifiers, not field names.
 *
 * @param fieldName - The field name or identifier to check
 * @returns true if the field name should be quoted in OData queries
 */
export function needsFieldQuoting(fieldName: string): boolean {
  // Entity IDs are identifiers and don't need quoting
  if (fieldName.startsWith("FMFID:") || fieldName.startsWith("FMTID:")) {
    return false;
  }
  // Always quote "id" as it's an OData reserved word
  if (fieldName.toLowerCase() === "id") {
    return true;
  }
  // Quote if field name contains spaces, underscores, or other special characters
  return fieldName.includes(" ") || fieldName.includes("_") || !VALID_FIELD_NAME_REGEX.test(fieldName);
}

/**
 * Formats select fields for use in OData query strings.
 * - Transforms field names to FMFIDs if using entity IDs
 * - Wraps "id" fields in double quotes (OData reserved)
 * - URL-encodes special characters but preserves spaces
 */
export function formatSelectFields(
  select: string[] | readonly string[] | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: Accepts any FMTable configuration
  table?: FMTable<any, any>,
  useEntityIds?: boolean,
): string {
  if (!select || select.length === 0) {
    return "";
  }

  const selectArray = Array.isArray(select) ? select : [select];

  // Transform to field IDs if using entity IDs
  const transformedFields =
    table && useEntityIds ? transformFieldNamesArray(selectArray.map(String), table) : selectArray.map(String);

  return transformedFields
    .map((field) => {
      if (needsFieldQuoting(field)) {
        return `"${field}"`;
      }
      const encoded = encodeURIComponent(field);
      return encoded.replace(/%20/g, " ");
    })
    .join(",");
}
