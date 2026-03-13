import { fmTableOccurrence, textField, timestampField } from "@proofkit/fmodata";

export const isolated_contacts = fmTableOccurrence(
  "isolated_contacts",
  {
    PrimaryKey: textField()
      .primaryKey()
      .entityId("FMFID:4296032394")
      .comment("Unique identifier of each record in this table"),
    CreationTimestamp: timestampField()
      .notNull()
      .entityId("FMFID:8590999690")
      .comment("Date and time each record was created"),
    CreatedBy: textField()
      .notNull()
      .entityId("FMFID:12885966986")
      .comment("Account name of the user who created each record"),
    ModificationTimestamp: timestampField()
      .notNull()
      .entityId("FMFID:17180934282")
      .comment("Date and time each record was last modified"),
    ModifiedBy: textField()
      .notNull()
      .entityId("FMFID:21475901578")
      .comment("Account name of the user who last modified each record"),
    name: textField().entityId("FMFID:25770868874"),
    hobby: textField().entityId("FMFID:30065836170"),
    id_user: textField().entityId("FMFID:38655770762"),
    my_calc: textField().readOnly().entityId("FMFID:42950738058"),
  },
  {
    entityId: "FMTID:1065098",
    navigationPaths: [],
  },
);
