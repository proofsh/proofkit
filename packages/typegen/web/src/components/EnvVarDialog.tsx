import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, Server, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { defaultEnvNames } from "../../../src/constants";
import { setDialogOpen, useTestConnection } from "../hooks/useTestConnection";
import type { SingleConfig } from "../lib/config-utils";
import { useEnvValue } from "../lib/envValues";
import { EnvVarField } from "./EnvVarField";
import { Alert, AlertContent, AlertDescription, AlertIcon } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Separator } from "./ui/separator";
import { useEnvVarIndicator } from "./useEnvVarIndicator";

interface EnvVarDialogProps {
  index: number;
}

// Helper to safely extract error message from various error formats
function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

export function EnvVarDialog({ index }: EnvVarDialogProps) {
  const { control, setValue, getValues } = useFormContext<{
    config: SingleConfig[];
  }>();
  const [dialogOpen, setDialogOpenState] = useState(false);

  // Track dialog open state to pause background tests
  useEffect(() => {
    setDialogOpen(index, dialogOpen);
    return () => {
      setDialogOpen(index, false);
    };
  }, [index, dialogOpen]);

  // Get indicator data
  const { hasCustomValues, serverValue, serverLoading, dbValue, dbLoading } = useEnvVarIndicator(index);

  // Watch the auth env names from the form
  const envNamesAuth = useWatch({
    control,
    name: `config.${index}.envNames.auth` as const,
  });

  // Determine the actual env names to use (from form or defaults)
  const apiKeyEnvName =
    envNamesAuth &&
    typeof envNamesAuth === "object" &&
    "apiKey" in envNamesAuth &&
    envNamesAuth.apiKey &&
    envNamesAuth.apiKey.trim() !== ""
      ? envNamesAuth.apiKey
      : defaultEnvNames.apiKey;
  const clarisIdUsernameEnvName =
    envNamesAuth &&
    typeof envNamesAuth === "object" &&
    "clarisIdUsername" in envNamesAuth &&
    envNamesAuth.clarisIdUsername &&
    envNamesAuth.clarisIdUsername.trim() !== ""
      ? envNamesAuth.clarisIdUsername
      : defaultEnvNames.clarisIdUsername;
  const clarisIdPasswordEnvName =
    envNamesAuth &&
    typeof envNamesAuth === "object" &&
    "clarisIdPassword" in envNamesAuth &&
    envNamesAuth.clarisIdPassword &&
    envNamesAuth.clarisIdPassword.trim() !== ""
      ? envNamesAuth.clarisIdPassword
      : defaultEnvNames.clarisIdPassword;
  const usernameEnvName =
    envNamesAuth &&
    typeof envNamesAuth === "object" &&
    "username" in envNamesAuth &&
    envNamesAuth.username &&
    envNamesAuth.username.trim() !== ""
      ? envNamesAuth.username
      : defaultEnvNames.username;
  const passwordEnvName =
    envNamesAuth &&
    typeof envNamesAuth === "object" &&
    "password" in envNamesAuth &&
    envNamesAuth.password &&
    envNamesAuth.password.trim() !== ""
      ? envNamesAuth.password
      : defaultEnvNames.password;

  // Resolve all auth env values
  const { data: apiKeyValue, isLoading: apiKeyLoading } = useEnvValue(apiKeyEnvName);
  const { data: clarisIdUsernameValue, isLoading: clarisIdUsernameLoading } = useEnvValue(clarisIdUsernameEnvName);
  const { data: clarisIdPasswordValue, isLoading: clarisIdPasswordLoading } = useEnvValue(clarisIdPasswordEnvName);
  const { data: usernameValue, isLoading: usernameLoading } = useEnvValue(usernameEnvName);
  const { data: passwordValue, isLoading: passwordLoading } = useEnvValue(passwordEnvName);

  // Determine which authentication method will be used
  // Precedence matches server-side auth resolution
  let activeAuthMethod: "apiKey" | "clarisId" | "username" | null = null;
  if (!apiKeyLoading && apiKeyValue !== undefined && apiKeyValue !== null && apiKeyValue !== "") {
    activeAuthMethod = "apiKey";
  } else if (
    !(clarisIdUsernameLoading || clarisIdPasswordLoading) &&
    clarisIdUsernameValue !== undefined &&
    clarisIdUsernameValue !== null &&
    clarisIdUsernameValue !== "" &&
    clarisIdPasswordValue !== undefined &&
    clarisIdPasswordValue !== null &&
    clarisIdPasswordValue !== ""
  ) {
    activeAuthMethod = "clarisId";
  } else if (
    !(usernameLoading || passwordLoading) &&
    usernameValue !== undefined &&
    usernameValue !== null &&
    usernameValue !== "" &&
    passwordValue !== undefined &&
    passwordValue !== null &&
    passwordValue !== ""
  ) {
    activeAuthMethod = "username";
  }

  // Test connection hook - enable when dialog is closed, disable when open
  // When dialog is open, it will only run when the retry button is clicked
  const {
    status: testStatus,
    data: testData,
    error: testError,
    errorDetails,
    run: runTest,
  } = useTestConnection(index, { enabled: !dialogOpen });

  // Check if any values resolve to undefined/null/empty (only check after loading completes)
  // For auth, check that at least one complete auth method is configured (either API key OR username+password)
  const hasApiKeyAuth = !apiKeyLoading && apiKeyValue !== undefined && apiKeyValue !== null && apiKeyValue !== "";
  const hasClarisIdAuth =
    !(clarisIdUsernameLoading || clarisIdPasswordLoading) &&
    clarisIdUsernameValue !== undefined &&
    clarisIdUsernameValue !== null &&
    clarisIdUsernameValue !== "" &&
    clarisIdPasswordValue !== undefined &&
    clarisIdPasswordValue !== null &&
    clarisIdPasswordValue !== "";
  const hasUsernamePasswordAuth =
    !(usernameLoading || passwordLoading) &&
    usernameValue !== undefined &&
    usernameValue !== null &&
    usernameValue !== "" &&
    passwordValue !== undefined &&
    passwordValue !== null &&
    passwordValue !== "";
  const hasAuth = hasApiKeyAuth || hasClarisIdAuth || hasUsernamePasswordAuth;

  const hasUndefinedValues =
    (!serverLoading && (serverValue === undefined || serverValue === null || serverValue === "")) ||
    (!dbLoading && (dbValue === undefined || dbValue === null || dbValue === "")) ||
    !(
      apiKeyLoading ||
      clarisIdUsernameLoading ||
      clarisIdPasswordLoading ||
      usernameLoading ||
      passwordLoading ||
      hasAuth
    );

  // Initialize auth fields if not already set
  useEffect(() => {
    const currentAuth = getValues(`config.${index}.envNames.auth` as const);
    if (!currentAuth) {
      setValue(`config.${index}.envNames.auth` as const, {
        apiKey: "",
        clarisIdUsername: "",
        clarisIdPassword: "",
        username: "",
        password: "",
      });
    } else if (typeof currentAuth === "object") {
      // Ensure all fields exist
      setValue(`config.${index}.envNames.auth` as const, {
        apiKey: currentAuth.apiKey || "",
        clarisIdUsername: currentAuth.clarisIdUsername || "",
        clarisIdPassword: currentAuth.clarisIdPassword || "",
        username: currentAuth.username || "",
        password: currentAuth.password || "",
      });
    }
  }, [setValue, getValues, index]);

  let authTypeLabel = "Username/Password";
  if (testData?.authType === "apiKey") {
    authTypeLabel = "API Key";
  } else if (testData?.authType === "clarisId") {
    authTypeLabel = "Claris ID";
  }

  return (
    <Dialog onOpenChange={setDialogOpenState} open={dialogOpen}>
      <div className="relative mr-2 overflow-visible">
        <DialogTrigger asChild>
          <Button className="relative" type="button" variant="outline">
            <Server className="size-4" />
            Connection Settings
            {testStatus === "error" && <AlertTriangle className="ml-2 size-4 text-yellow-500" />}
          </Button>
        </DialogTrigger>
        {(hasUndefinedValues || hasCustomValues) && (
          <span
            className={`pointer-events-none absolute -top-1 -right-1 z-50 flex h-5 w-5 items-center justify-center rounded-full font-semibold text-[10px] ${
              hasUndefinedValues ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {hasUndefinedValues ? "!" : "•"}
          </span>
        )}
      </div>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom Environment Variable Names</DialogTitle>
          <DialogDescription>
            Enter the <span className="font-medium text-foreground">names</span> of the environment variables below, not
            the values
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EnvVarField
              defaultValue={defaultEnvNames.server}
              fieldName={`config.${index}.envNames.server` as const}
              label="Server"
              placeholder={defaultEnvNames.server}
            />

            <EnvVarField
              defaultValue={defaultEnvNames.db}
              fieldName={`config.${index}.envNames.db` as const}
              label="Database"
              placeholder={defaultEnvNames.db}
            />

            <div className="col-span-full">
              <Card className="bg-transparent">
                <CardContent className="space-y-4 bg-transparent">
                  <CardTitle>Authentication</CardTitle>
                  {/* API Key on its own line */}
                  <EnvVarField
                    defaultValue={defaultEnvNames.apiKey}
                    dimField={activeAuthMethod !== "apiKey"}
                    fieldName={`config.${index}.envNames.auth.apiKey` as const}
                    label="API Key"
                    placeholder={defaultEnvNames.apiKey}
                  />

                  {/* OR Divider */}
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="font-medium text-muted-foreground text-sm">OR</span>
                    <Separator className="flex-1" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <EnvVarField
                      defaultValue={defaultEnvNames.clarisIdUsername}
                      dimField={activeAuthMethod !== "clarisId"}
                      fieldName={`config.${index}.envNames.auth.clarisIdUsername` as const}
                      label="Claris ID Username"
                      placeholder={defaultEnvNames.clarisIdUsername}
                    />

                    <EnvVarField
                      defaultValue={defaultEnvNames.clarisIdPassword}
                      dimField={activeAuthMethod !== "clarisId"}
                      fieldName={`config.${index}.envNames.auth.clarisIdPassword` as const}
                      label="Claris ID Password"
                      placeholder={defaultEnvNames.clarisIdPassword}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="font-medium text-muted-foreground text-sm">OR</span>
                    <Separator className="flex-1" />
                  </div>

                  {/* Username and Password on the same line */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <EnvVarField
                      defaultValue={defaultEnvNames.username}
                      dimField={activeAuthMethod !== "username"}
                      fieldName={`config.${index}.envNames.auth.username` as const}
                      label="Username"
                      placeholder={defaultEnvNames.username}
                    />

                    <EnvVarField
                      defaultValue={defaultEnvNames.password}
                      dimField={activeAuthMethod !== "username"}
                      fieldName={`config.${index}.envNames.auth.password` as const}
                      label="Password"
                      placeholder={defaultEnvNames.password}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert appearance="light" size="sm" variant="mono">
            <AlertIcon>
              <Info className="size-4" />
            </AlertIcon>
            <AlertContent>
              <AlertDescription>
                You will need to rerun the{" "}
                <code className="rounded-md bg-muted px-1 py-0.5 font-mono">@proofkit/typegen ui</code> command if you
                change any environment variables.
              </AlertDescription>
            </AlertContent>
          </Alert>

          {/* Test Connection Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Connection Status</h4>
              <Button
                disabled={testStatus === "pending"}
                onClick={() => runTest()}
                size="sm"
                type="button"
                variant="outline"
              >
                {testStatus === "pending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Retry Test"
                )}
              </Button>
            </div>

            {/* Test Results - Show automatically when available */}
            {testStatus !== "idle" && (
              <div
                className={`rounded-md border p-3 text-sm ${(() => {
                  if (testStatus === "success") {
                    return "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400";
                  }
                  if (testStatus === "error") {
                    return "border-destructive/50 bg-destructive/10 text-destructive";
                  }
                  return "";
                })()}`}
              >
                {testStatus === "pending" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Testing connection...</span>
                  </div>
                )}

                {testStatus === "success" && testData && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Connection OK</span>
                    </div>
                    <div className="space-y-0.5 pl-6 text-xs">
                      <div>
                        <span className="font-medium">Server:</span> {testData.server}
                      </div>
                      <div>
                        <span className="font-medium">Database:</span> {testData.db}
                      </div>
                      <div>
                        <span className="font-medium">Auth Type:</span> {authTypeLabel}
                      </div>
                    </div>
                  </div>
                )}

                {testStatus === "error" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <XCircle className="h-4 w-4" />
                      <span>Connection Failed</span>
                    </div>
                    {errorDetails && (
                      <div className="space-y-1 pl-6 text-xs">
                        <div className="font-medium">
                          {errorDetails.message || getErrorMessage(errorDetails.error as unknown) || "Unknown error"}
                        </div>
                        {errorDetails.details?.missing && (
                          <div className="space-y-0.5">
                            <div className="font-medium">Missing environment variables:</div>
                            <ul className="list-inside list-disc space-y-0.5">
                              {errorDetails.details.missing.server && (
                                <li>Server ({errorDetails.suspectedField === "server" && "⚠️"})</li>
                              )}
                              {errorDetails.details.missing.db && (
                                <li>Database ({errorDetails.suspectedField === "db" && "⚠️"})</li>
                              )}
                              {errorDetails.details.missing.auth && (
                                <li>Authentication ({errorDetails.suspectedField === "auth" && "⚠️"})</li>
                              )}
                              {errorDetails.details.missing.password && (
                                <li>Password ({errorDetails.suspectedField === "auth" && "⚠️"})</li>
                              )}
                              {errorDetails.details.missing.clarisIdPassword && (
                                <li>Claris ID Password ({errorDetails.suspectedField === "auth" && "⚠️"})</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {errorDetails.fmErrorCode && (
                          <div>
                            <span className="font-medium">FileMaker Error Code:</span> {errorDetails.fmErrorCode}
                          </div>
                        )}
                        {errorDetails.suspectedField && !errorDetails.details?.missing && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>
                              Suspected issue with: {(() => {
                                if (errorDetails.suspectedField === "server") {
                                  return "Server URL";
                                }
                                if (errorDetails.suspectedField === "db") {
                                  return "Database name";
                                }
                                return "Credentials";
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {testError && !errorDetails && (
                      <div className="pl-6 text-xs">
                        {(() => {
                          if (testError instanceof Error) {
                            return testError.message;
                          }
                          if (typeof testError === "object" && testError !== null && "message" in testError) {
                            return String((testError as { message: unknown }).message);
                          }
                          return "Unknown error";
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
