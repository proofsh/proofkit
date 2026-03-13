import { fmTableOccurrence, numberField, textField } from "@proofkit/fmodata";

export const fmdapi_test = fmTableOccurrence(
  "fmdapi_test",
  {
    PrimaryKey: textField()
      .primaryKey()
      .entityId("FMFID:4296032385")
      .comment("Unique identifier of each record in this table"),
    recordId: numberField().readOnly().entityId("FMFID:30065836161"),
  },
  {
    entityId: "FMTID:1065089",
    navigationPaths: [],
  },
);
