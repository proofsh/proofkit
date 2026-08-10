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

Every path must end by assigning `$result` and calling `SendCallBack`. The adapter treats a missing callback as a timeout, and rejects anything whose `messages[0].code` is not `"0"`.

```text
Set Error Capture [ On ]

# 1. Parse the envelope
Set Variable [ $json ; Value: Get ( ScriptParameter ) ]
Set Variable [ $callback ; Value: JSONGetElement ( $json ; "callback" ) ]
Set Variable [ $data ; Value: JSONGetElement ( $json ; "data" ) ]
Set Variable [ $webViewerName ; Value: JSONGetElement ( $callback ; "webViewerName" ) ]
If [ IsEmpty ( $webViewerName ) ]
  Set Variable [ $webViewerName ; Value: "web" ]   # the add-on's default object name
End If
Set Variable [ $layout ; Value: JSONGetElement ( $data ; "layout" ) ]
Set Variable [ $recordId ; Value: JSONGetElement ( $data ; "recordId" ) ]
Set Variable [ $fieldName ; Value: JSONGetElement ( $data ; "containerFieldName" ) ]
Set Variable [ $fileName ; Value: JSONGetElement ( $data ; "fileName" ) ]
Set Variable [ $base64 ; Value: JSONGetElement ( $data ; "base64" ) ]
Set Variable [ $repetitionInput ; Value: JSONGetElement ( $data ; "repetition" ) ]
Set Variable [ $repetitionType ; Value: JSONGetElementType ( $data ; "repetition" ) ]
Set Variable [ $repetitionIsValid ; Value: ( IsEmpty ( $repetitionInput ) and IsEmpty ( $repetitionType ) ) or ( $repetitionType = JSONNumber and GetAsNumber ( $repetitionInput ) = 1 ) ]
Set Variable [ $repetition ; Value: 1 ]
Set Variable [ $modId ; Value: JSONGetElement ( $data ; "modId" ) ]   # empty when absent

# 2. Navigate by record ID, in a new window
If [ not $repetitionIsValid ]
  Set Variable [ $result ; Value: PK_error ( 500 ; "Only container repetition 1 is supported" ) ]
Else
  Set Variable [ $callerWindow ; Value: Get ( WindowName ) ]
  Go to List of Records [ List of record IDs: $recordId ; Using layout: $layout ; Show in new window: On ; Animation: None ]
  Set Variable [ $navigationError ; Value: JSONSetElement ( "{}" ; [ "code" ; Get ( LastError ) ; JSONNumber ] ; [ "message" ; Get ( LastErrorText ) ; JSONString ] ) ]
  Set Variable [ $error ; Value: JSONGetElement ( $navigationError ; "code" ) ]
  Set Variable [ $errorMessage ; Value: JSONGetElement ( $navigationError ; "message" ) ]
  Set Variable [ $openedWindow ; Value: Get ( WindowName ) ≠ $callerWindow ]

  If [ $error = 105 ]
    Set Variable [ $result ; Value: PK_error ( 105 ; "Layout is missing" ) ]
  Else If [ $error = 101 ]
    Set Variable [ $result ; Value: PK_error ( 101 ; "Record is missing" ) ]
  Else If [ $error ≠ 0 ]
    Set Variable [ $result ; Value: PK_error ( $error ; $errorMessage ) ]
  Else If [ Get ( FoundCount ) = 0 ]
    Set Variable [ $result ; Value: PK_error ( 101 ; "Record is missing" ) ]
  Else If [ IsEmpty ( JSONGetElement ( $data ; "modId" ) ) = False and Get ( RecordModificationCount ) ≠ GetAsNumber ( $modId ) ]
    Set Variable [ $result ; Value: PK_error ( 306 ; "Record modification ID does not match" ) ]
  Else
    # 3. Decode, then write valid data while capturing errors after each step
    Set Variable [ $fullFieldName ; Value: Get ( LayoutTableName ) & "::" & $fieldName ]
    Set Variable [ $decoded ; Value: Base64Decode ( $base64 ; $fileName ) ]
    If [ IsEmpty ( $decoded ) or $decoded = "?" ]
      Set Variable [ $result ; Value: PK_error ( 500 ; "Could not decode file data" ) ]
    Else
      Set Field By Name [ $fullFieldName ; $decoded ]
      Set Variable [ $fieldError ; Value: JSONSetElement ( "{}" ; [ "code" ; Get ( LastError ) ; JSONNumber ] ; [ "message" ; Get ( LastErrorText ) ; JSONString ] ) ]
      Set Variable [ $error ; Value: JSONGetElement ( $fieldError ; "code" ) ]
      Set Variable [ $errorMessage ; Value: JSONGetElement ( $fieldError ; "message" ) ]
      Commit Records/Requests [ With dialog: Off ]
      Set Variable [ $commitError ; Value: JSONSetElement ( "{}" ; [ "code" ; Get ( LastError ) ; JSONNumber ] ; [ "message" ; Get ( LastErrorText ) ; JSONString ] ) ]
      If [ JSONGetElement ( $commitError ; "code" ) ≠ 0 ]
        Set Variable [ $error ; Value: JSONGetElement ( $commitError ; "code" ) ]
        Set Variable [ $errorMessage ; Value: JSONGetElement ( $commitError ; "message" ) ]
      End If

      If [ $error = 0 ]
        Set Variable [ $result ; Value: PK_ok ]
      Else
        Set Variable [ $result ; Value: PK_error ( $error ; $errorMessage ) ]
      End If
    End If
  End If
End If

# 4. Close the window on every path, then call back
If [ $openedWindow ]
  Close Window [ Current Window ]
End If
Set Variable [ $callback ; Value: JSONSetElement ( $callback ;
  [ "result" ; $result ; JSONObject ] ;
  [ "webViewerName" ; $webViewerName ; JSONString ] ) ]
Perform Script [ Specified: From list ; "SendCallBack" ; Parameter: $callback ]
```

`PK_ok` and `PK_error ( code ; message )` above stand in for whatever you use to build the envelope. They must produce exactly:

```json
{ "messages": [{ "code": "0", "message": "OK" }], "response": {} }
```

```json
{ "messages": [{ "code": "102", "message": "Field is missing" }], "response": {} }
```

Note `code` is a **string** in both. A numeric `0` will not match the adapter's check and a successful write would be reported as a failure.

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

Current client-side handling, pending the answer to open question 4: the adapter applies a timeout to `containerUpload` and, on expiry, rejects with `ContainerUploadTimeoutError`. If you would rather have positive detection, the script could accept `{ "action": "capabilities" }` and return a version number, which the adapter would call once per instance and cache.

### The timeout is an unknown outcome, not a failure

`Promise.race` ends the JavaScript wait. It cannot stop a FileMaker script that is already running, so a slow upload can commit *after* `containerUpload()` has rejected. The adapter therefore reports the timeout as an unknown outcome (`ContainerUploadTimeoutError` carries `outcome: "unknown"`) rather than claiming the script never ran.

What makes this tolerable today is that the write is **idempotent**: the script sets one container field on one record from a payload that fully determines the result. Uploading the same file to the same record and field twice leaves the same end state, so a retry after a timeout cannot corrupt anything. Two things must stay true for that to hold, and both are requirements on the script:

- The script must not append, version, or create related records as a side effect of the upload.
- The script must not treat "container already populated" as an error.

If a future version needs side effects, this contract needs a request identity: the adapter would send a client-generated `requestId`, the script would record it, and a repeated `requestId` would return the original result instead of re-running the write. Worth designing then, not now — but do not add side effects to the script without it.

## Test cases

- Valid upload to an empty container field.
- Valid upload overwriting an existing container.
- Non-existent `recordId` → `101`.
- Field name not present on the layout → `102`.
- Non-existent layout → `105`.
- Stale `modId` → `306`, and the container is unchanged.
- Malformed Base64 → non-zero code, container unchanged.
- Uploading the same file to the same record twice → same end state, no duplicate side effects.
- Every failure path closes the window it opened and still calls `SendCallBack`.
- The user's original window keeps its layout, found set, and current record in every case above.
- A `Get Container` round trip after upload returns the same bytes and the same file name.
