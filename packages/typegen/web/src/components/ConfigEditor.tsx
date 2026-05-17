import { Loader2, PlayIcon, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useRunTypegen } from "../hooks/useRunTypegen";
import type { SingleConfig } from "../lib/config-utils";
import { EnvVarDialog } from "./EnvVarDialog";
import { InfoTooltip } from "./InfoTooltip";
import { LayoutEditor } from "./LayoutEditor";
import { MetadataTablesEditor } from "./MetadataTablesEditor";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch, SwitchIndicator, SwitchWrapper } from "./ui/switch";
import { SwitchField } from "./ui/switch-field";

interface ConfigEditorProps {
  index: number;
  onRemove: () => void;
}

export function ConfigEditor({ index, onRemove }: ConfigEditorProps) {
  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<{ config: SingleConfig[] }>();

  const hasMultipleConfigs = watch("config").length > 1;

  const baseId = useId();
  const generateClientSwitchId = `${baseId}-generate-client`;
  const configType = watch(`config.${index}.type` as const);
  const generateClient = useWatch({
    control,
    name: `config.${index}.generateClient` as const,
  });

  const configErrors = errors.config?.[index];
  const webviewerScriptName = useWatch({
    control,
    name: `config.${index}.webviewerScriptName` as const,
  });
  const fmMcp = useWatch({
    control,
    name: `config.${index}.fmMcp` as const,
  });
  const [usingWebviewer, setUsingWebviewer] = useState(!!webviewerScriptName);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const { runTypegen, isRunning } = useRunTypegen();

  // Get the current config value
  const currentConfig = watch(`config.${index}` as const);

  useEffect(() => {
    setUsingWebviewer(!!webviewerScriptName);
  }, [webviewerScriptName]);

  const handleWebviewerToggle = (checked: boolean) => {
    setUsingWebviewer(checked);
    if (!checked) {
      setValue(`config.${index}.webviewerScriptName` as const, "");
    }
  };

  const handleFmMcpToggle = (checked: boolean) => {
    setValue(`config.${index}.fmMcp` as const, checked ? { enabled: true } : undefined, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const handleRunTypegen = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await runTypegen(currentConfig);
    } catch (err) {
      console.error("Failed to run typegen:", err);
    }
  };

  return (
    <div className="space-y-6">
      {configErrors?.root && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          <strong>Error:</strong> {configErrors.root.message}
        </div>
      )}

      <div className="space-y-8">
        {/* General Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between overflow-visible pt-3 pr-1">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">General Settings</h3>
            </div>

            <div className="flex items-center gap-2">
              <EnvVarDialog index={index} />
              {hasMultipleConfigs && (
                <Button appearance="ghost" disabled={isRunning} onClick={handleRunTypegen} size="sm" variant="success">
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                </Button>
              )}
              <Button
                appearance="ghost"
                className="gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowRemoveDialog(true);
                }}
                size="sm"
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {/* First row: Display Name, Output Path, Clear Old Files */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={control}
                name={`config.${index}.configName`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Display Name <InfoTooltip label="The name of this connection displayed in this UI only" />
                    </FormLabel>

                    <FormControl>
                      <Input placeholder="schema" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`config.${index}.path`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Output Path{" "}
                      <InfoTooltip label="The path to the directory where the generated files will be saved." />
                    </FormLabel>

                    <FormControl>
                      <Input placeholder="schema" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`config.${index}.clearOldFiles` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <SwitchField
                        checked={field.value ?? false}
                        infoTooltip="Clear old files will clear the path before the new files are written. Only the `client` and `generated` directories are cleared to allow for potential overrides to be kept."
                        label="Clear Old Files"
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Second row: Generate Client, Client Suffix, and Validator */}
            {configType === "fmdapi" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={control}
                  name={`config.${index}.generateClient` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generate</FormLabel>
                      <FormControl>
                        <div className="flex w-full items-center">
                          <SwitchWrapper className="inline-grid w-full" permanent={true}>
                            <Switch
                              checked={field.value}
                              className="h-9 w-full rounded-md"
                              id={generateClientSwitchId}
                              onCheckedChange={field.onChange}
                              size="xl"
                              thumbClassName="rounded-md"
                            />
                            <SwitchIndicator
                              className="w-1/2 text-accent-foreground peer-data-[state=checked]:text-primary"
                              state="off"
                            >
                              Full Client
                            </SwitchIndicator>
                            <SwitchIndicator
                              className="w-1/2 text-accent-foreground peer-data-[state=unchecked]:text-primary"
                              state="on"
                            >
                              Types Only
                            </SwitchIndicator>
                          </SwitchWrapper>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {generateClient && (
                  <FormField
                    control={control}
                    name={`config.${index}.clientSuffix` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Suffix</FormLabel>
                        <FormControl>
                          <Input placeholder="Layout" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {generateClient && (
                  <FormField
                    control={control}
                    name={`config.${index}.validator` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validator</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value === "false" ? false : value);
                            }}
                            value={field.value === false ? "false" : String(field.value || "")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select validator" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="zod/v4">zod/v4</SelectItem>
                              <SelectItem value="zod/v3">zod/v3</SelectItem>
                              <SelectItem value="zod">zod</SelectItem>
                              <SelectItem value="false">false</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {configType === "fmodata" && (
              <div className="flex items-start gap-4">
                <FormField
                  control={control}
                  name={`config.${index}.reduceMetadata` as const}
                  render={({ field }) => (
                    <SwitchField
                      checked={field.value ?? false}
                      infoTooltip="Request reduced OData annotations to reduce payload size. This will prevent comments, entity ids, and other properties from being generated."
                      label="Reduce Metadata Annotations"
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name={`config.${index}.alwaysOverrideFieldNames` as const}
                  render={({ field }) => (
                    <SwitchField
                      checked={field.value ?? false}
                      infoTooltip="If true, the field names in your generated schema may be updated to match FileMaker. This may cause TypeScript errors in your code. If you only use entity IDs in your OData requests, you can safely leave this off."
                      label="Always Update Field Names"
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name={`config.${index}.includeAllFieldsByDefault` as const}
                  render={({ field }) => (
                    <SwitchField
                      checked={field.value ?? true}
                      infoTooltip="If true, all fields from metadata will be included unless explicitly excluded. If false, only fields defined in the fields array will be included."
                      label="Include All Fields By Default"
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}

            {/* Final row: Using a Webviewer switch with script name inline */}
            {configType === "fmdapi" && (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <SwitchField
                    checked={usingWebviewer}
                    label="Generate Webviewer Client"
                    onCheckedChange={handleWebviewerToggle}
                    topLabel="Webviewer Options"
                  />
                </div>
                {usingWebviewer && (
                  <div className="min-w-0 flex-1">
                    <FormField
                      control={control}
                      name={`config.${index}.webviewerScriptName` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Webviewer Script Name{" "}
                            <InfoTooltip label="The name of the webviewer script that uses the @proofkit/webviewer pattern and passes the input to the Execute Data API script step." />
                          </FormLabel>
                          <FormControl>
                            <Input required {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {configType === "fmdapi" && (
              <div className="space-y-4 rounded-md border p-4">
                <SwitchField
                  checked={!!fmMcp && fmMcp.enabled !== false}
                  infoTooltip="Use the local FileMaker MCP bridge for metadata discovery in this UI and typegen runs. Authorization is kept in memory while the UI server is running unless you provide a persistent token env var."
                  label="Use FileMaker Bridge"
                  onCheckedChange={handleFmMcpToggle}
                />

                {!!fmMcp && fmMcp.enabled !== false && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField
                      control={control}
                      name={`config.${index}.fmMcp.baseUrl` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bridge URL</FormLabel>
                          <FormControl>
                            <Input placeholder="http://127.0.0.1:1365" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`config.${index}.fmMcp.connectedFileName` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            File Name <InfoTooltip label="Optional when exactly one FileMaker file is connected." />
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="MyFile" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`config.${index}.fmMcp.scriptName` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Script Name</FormLabel>
                          <FormControl>
                            <Input placeholder="execute_data_api" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {configType === "fmdapi" && <LayoutEditor configIndex={index} />}
        {configType === "fmodata" && <MetadataTablesEditor configIndex={index} />}
      </div>

      {/* Remove Config Confirmation Dialog */}
      <Dialog onOpenChange={setShowRemoveDialog} open={showRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Config</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this config? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowRemoveDialog(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              onClick={() => {
                onRemove();
                setShowRemoveDialog(false);
              }}
              type="button"
              variant="destructive"
            >
              Remove Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
