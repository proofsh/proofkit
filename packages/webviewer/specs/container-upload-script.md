# Spec: `PK_container_upload` FileMaker script

Contract between the ProofKit add-on and `WebViewerAdapter.containerUpload()` in `@proofkit/webviewer`.

Status: draft, for implementation of the FileMaker side. The TypeScript side will be built against this document.

## Why a script is needed

The Data API uploads containers through a separate multipart endpoint, not through its JSON action set. The `Execute FileMaker Data API` script step only exposes the JSON actions, so container upload cannot ride the existing `PK_execute_data_api` script. It needs its own script that decodes Base64 and writes the container field directly.

## Why a separate script rather than a new action on `PK_execute_data_api`

- Container upload is not a Data API action; overloading that script's contract muddies both.
- It must never participate in request batching.
- Payloads are far larger than a typical Data API call, so the two have different performance characteristics.

## Requirements

- **FileMaker Pro 22.0 (2025) or later**, for the `Go to List of Records` script step.
- The `SendCallBack` script already shipped with the add-on.

## Script name

`PK_container_upload`

Matches the existing `PK_execute_data_api` convention. The adapter will expose a `containerScriptName` option that defaults to this, so a solution can rename it.

## Input

The script is called by `fmFetch`, so `Get ( ScriptParameter )` is the standard envelope:

```json
{
  "data": {
    "layout": "API_Assets",
    "recordId": 3,
    "containerFieldName": "Photo",
    "repetition": 1,
    "fileName": "document.pdf",
    "base64": "JVBERi0xLjQK...",
    "modId": 7
  },
  "callback": {
    "fetchId": "0f1c...",
    "fn": "handleFmWVFetchCallback",
    "webViewerName": "web"
  }
}
```

| `data` key           | Type             | Required | Notes                                                                                             |
| -------------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `layout`             | string           | yes      | Layout name the record is reached through.                                                        |
| `recordId`           | number           | yes      | FileMaker internal record ID, same value the Data API returns.                                    |
| `containerFieldName` | string           | yes      | Field name only, no table occurrence prefix. Build the full name from `Get ( LayoutTableName )`.   |
| `repetition`         | number           | no       | Defaults to `1`.                                                                                  |
| `fileName`           | string           | yes      | Original file name including extension. Must be passed to `Base64Decode`.                         |
| `base64`             | string           | yes      | Unpadded-safe RFC 4648 Base64, no line breaks.                                                    |
| `modId`              | number           | no       | When present, reject the write if the record's modification count no longer matches.              |

Take `webViewerName` from `callback.webViewerName`. Fall back to the add-on's default Web Viewer name when it is empty.

## Output

Return the same envelope shape as `PK_execute_data_api` so the adapter can reuse its existing error handling and `FileMakerError` type.

Success:

```json
{
  "messages": [{ "code": "0", "message": "OK" }],
  "response": {}
}
```

Failure:

```json
{
  "messages": [{ "code": "102", "message": "Field is missing" }],
  "response": {}
}
```

`code` must be a **string**, matching the Data API convention. Use the real FileMaker error code from `Get ( LastError )` wherever one exists.

### Error codes to return

| Situation                                | Code  | Message                                    |
| ---------------------------------------- | ----- | ------------------------------------------ |
| Record ID not found                      | `101` | `Record is missing`                         |
| Container field not on layout / not found | `102` | `Field is missing`                          |
| Layout not found                         | `105` | `Layout is missing`                         |
| `modId` mismatch                         | `306` | `Record modification ID does not match`     |
| Base64 decode produced an empty container | `500` | `Could not decode file data`                |
| Any other captured error                 | actual `Get ( LastError )` | FileMaker's text |

## Behavior

```
Set Error Capture [ On ]

# 1. Parse the envelope
Set Variable [ $json ; Value: Get ( ScriptParameter ) ]
Set Variable [ $callback ; Value: JSONGetElement ( $json ; "callback" ) ]
Set Variable [ $data ; Value: JSONGetElement ( $json ; "data" ) ]
Set Variable [ $webViewerName ; Value: JSONGetElement ( $callback ; "webViewerName" ) ]
Set Variable [ $layout ; Value: JSONGetElement ( $data ; "layout" ) ]
Set Variable [ $recordId ; Value: JSONGetElement ( $data ; "recordId" ) ]
Set Variable [ $fieldName ; Value: JSONGetElement ( $data ; "containerFieldName" ) ]
Set Variable [ $fileName ; Value: JSONGetElement ( $data ; "fileName" ) ]
Set Variable [ $base64 ; Value: JSONGetElement ( $data ; "base64" ) ]

# 2. Navigate by record ID, in a new window
Go to List of Records [ List of record IDs: $recordId ; Using layout: $layout ; Show in new window: On ; Animation: None ]

# 3. Verify, then write
Set Variable [ $fullFieldName ; Value: Get ( LayoutTableName ) & "::" & $fieldName ]
Set Field By Name [ $fullFieldName ; Base64Decode ( $base64 ; $fileName ) ]
Commit Records/Requests [ With dialog: Off ]

# 4. Close the window, then call back
Close Window [ Current Window ]
Set Variable [ $callback ; Value: JSONSetElement ( $callback ;
  [ "result" ; $result ; JSONObject ] ;
  [ "webViewerName" ; $webViewerName ; JSONString ] ) ]
Perform Script [ Specified: From list ; "SendCallBack" ; Parameter: $callback ]
```

### Critical: never send the callback from another layout

`SendCallBack` uses `Perform JavaScript in Web Viewer`, which can only reach a Web Viewer on the layout that is current when the step runs. If the script sends the callback while sitting on `$layout`, the call silently does nothing and the `fmFetch` promise on the JavaScript side never settles.

`Go to List of Records` has a **Show in new window** parameter, so navigation and window creation are one step. Close that window before calling `SendCallBack`. Script variables survive the window closing, so build `$result` inside the window and use it afterward.

### Window cleanup on every path

Every exit path must close the window it opened, including error paths. If the window is left open, the user is stranded on a utility layout. Suggested approach: capture `Get ( WindowName )` before the step and only close if a new window actually opened, so a navigation failure that never created a window does not close the user's window instead.

### Found set

`Go to List of Records` replaces the found set in the window it targets. Because that is a new window, the user's found set in the original window is untouched. This is the main reason for the new-window approach beyond the callback constraint.

### Error detection after navigation

`Go to List of Records` ignores record IDs it cannot find and returns `101` or `401`. Check both `Get ( LastError )` and `Get ( FoundCount ) = 0` — a missing ID yields an empty found set rather than a hard failure.

## Open questions for the FileMaker side

1. **Repetition targeting.** `Set Field By Name` takes a calculated field name. Confirm whether a repetition can be addressed as `Table::Field[2]` in that expression, or whether a `Set Field` with an explicit repetition target and a branch is needed. If repetitions cannot be supported cleanly, say so and the adapter will reject `repetition > 1` client-side with a clear error.
2. **`modId` check.** Confirm `Get ( RecordModificationCount )` is the right comparison for the Data API's `modId`.
3. **Practical payload ceiling.** How large a Base64 string can move through `Get ( ScriptParameter )` before it becomes unusable? The adapter will enforce a client-side size limit and should use a real number.
4. **Missing-script behavior.** If a solution has an older add-on without this script, what does `FileMaker.PerformScript` do — silent no-op, or user-facing error dialog? This determines whether the adapter needs a timeout to produce "update your ProofKit add-on" instead of a promise that hangs forever. See below.

## Version detection

Unlike the batching change, this is a brand-new script rather than a new key on an existing one, so the established `1708 / unknown key` detection in `adapter.ts` does not apply. An old add-on has no script to respond at all.

Planned client-side handling, pending the answer to open question 4: the adapter applies a timeout to `containerUpload` and, on expiry, throws an error instructing the user to update the ProofKit add-on. If you would rather have positive detection, the script could accept `{ "action": "capabilities" }` and return a version number, which the adapter would call once per instance and cache.

## Test cases

- Valid upload to an empty container field.
- Valid upload overwriting an existing container.
- Non-existent `recordId` → `101`.
- Field name not present on the layout → `102`.
- Non-existent layout → `105`.
- Stale `modId` → `306`, and the container is unchanged.
- Malformed Base64 → non-zero code, container unchanged.
- The user's original window keeps its layout, found set, and current record in every case above.
- A `Get Container` round trip after upload returns the same bytes and the same file name.
