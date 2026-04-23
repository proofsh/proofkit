import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type Path, useFormContext } from "react-hook-form";
import { Button, ButtonArrow } from "@/components/ui/button";
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { client } from "@/lib/api";
import type { SingleConfig } from "@/lib/config-utils";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

interface FormData {
  config: SingleConfig[];
}

interface ErrorDetails {
  missing?: {
    server?: boolean;
    db?: boolean;
    auth?: boolean;
    password?: boolean;
  };
  fmErrorCode?: string;
  suspectedField?: "server" | "db" | "auth";
}

interface ErrorWithDetails extends Error {
  details?: ErrorDetails;
}

export function LayoutSelector({ configIndex, path }: { configIndex: number; path: Path<FormData> }) {
  const { control, setValue, getValues } = useFormContext<FormData>();
  const [open, setOpen] = useState(false);

  const {
    data: layouts,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["layouts", configIndex],
    queryFn: async () => {
      const res = await client.api.layouts.$get({
        query: { configIndex: configIndex.toString() },
      });

      const data = (await res.json()) as
        | { layouts: Array<{ name: string }> }
        | {
            error: string;
            missing?: {
              server?: boolean;
              db?: boolean;
              auth?: boolean;
              password?: boolean;
            };
            fmErrorCode?: string;
            suspectedField?: "server" | "db" | "auth";
          };
      if (!res.ok || "error" in data) {
        // Parse error JSON to get detailed error information
        const errorMessage = "error" in data ? data.error : "Failed to fetch layouts";
        const error = new Error(errorMessage) as ErrorWithDetails;
        // Preserve error details from the API response
        if ("error" in data) {
          error.details = {
            missing: data.missing,
            fmErrorCode: data.fmErrorCode,
            suspectedField: data.suspectedField,
          };
        }
        throw error;
      }
      return data.layouts;
    },
  });

  // Extract error details from the error object
  const errorDetails = error && (error as ErrorWithDetails).details;

  // Transform layouts array into combobox format
  const layoutOptions = useMemo(() => {
    if (!layouts) {
      return [];
    }
    return layouts.map((layout) => ({
      value: layout.name,
      label: layout.name,
    }));
  }, [layouts]);

  return (
    <FormField
      control={control}
      name={path}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Layout Name <InfoTooltip label="The layout name from your FileMaker file" />
          </FormLabel>
          <FormControl>
            <Popover onOpenChange={setOpen} open={open}>
              <PopoverTrigger asChild>
                <Button
                  aria-expanded={open}
                  className="w-full justify-between"
                  disabled={isLoading || isError}
                  mode="input"
                  placeholder={!field.value}
                  role="combobox"
                  variant="outline"
                >
                  <span className={cn("truncate")}>
                    {field.value
                      ? layoutOptions.find((layout) => layout.value === field.value)?.label
                      : "Select layout..."}
                  </span>
                  <ButtonArrow />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popper-anchor-width) p-0">
                <Command>
                  <CommandInput placeholder="Search layout..." />
                  <CommandList>
                    {(() => {
                      if (isLoading) {
                        return <div className="py-6 text-center text-muted-foreground text-sm">Loading layouts...</div>;
                      }
                      if (isError) {
                        return (
                          <div className="space-y-2 px-4 py-6 text-destructive text-sm">
                            <div className="text-center font-medium">
                              {error instanceof Error ? error.message : "Failed to load layouts"}
                            </div>
                            {errorDetails && (
                              <div className="space-y-1 text-xs">
                                {errorDetails.missing && (
                                  <div>
                                    <div className="font-medium">Missing environment variables:</div>
                                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                                      {errorDetails.missing.server && (
                                        <li>
                                          Server
                                          {errorDetails.suspectedField === "server" && " ⚠️"}
                                        </li>
                                      )}
                                      {errorDetails.missing.db && (
                                        <li>
                                          Database
                                          {errorDetails.suspectedField === "db" && " ⚠️"}
                                        </li>
                                      )}
                                      {errorDetails.missing.auth && (
                                        <li>
                                          Authentication
                                          {errorDetails.suspectedField === "auth" && " ⚠️"}
                                        </li>
                                      )}
                                      {errorDetails.missing.password && (
                                        <li>
                                          Password
                                          {errorDetails.suspectedField === "auth" && " ⚠️"}
                                        </li>
                                      )}
                                      {errorDetails.missing.clarisIdPassword && (
                                        <li>
                                          Claris ID Password
                                          {errorDetails.suspectedField === "auth" && " ⚠️"}
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                )}
                                {errorDetails.fmErrorCode && (
                                  <div>
                                    <span className="font-medium">FileMaker Error Code:</span>{" "}
                                    {errorDetails.fmErrorCode}
                                  </div>
                                )}
                                {errorDetails.suspectedField && !errorDetails.missing && (
                                  <div>
                                    Suspected issue with: {(() => {
                                      if (errorDetails.suspectedField === "server") {
                                        return "Server URL";
                                      }
                                      if (errorDetails.suspectedField === "db") {
                                        return "Database name";
                                      }
                                      return "Credentials";
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="pt-2 text-center text-xs opacity-75">
                              Check your connection settings in "Configure Environment Variables"
                            </div>
                          </div>
                        );
                      }
                      return (
                        <>
                          <CommandEmpty>No layout found.</CommandEmpty>
                          <CommandGroup>
                            {layoutOptions.map((layout) => (
                              <CommandItem
                                key={layout.value}
                                onSelect={(currentValue) => {
                                  const newValue = currentValue === field.value ? "" : currentValue;
                                  field.onChange(newValue);

                                  // If schema name is undefined or empty, set it to the layout name
                                  if (newValue) {
                                    const schemaNamePath = path.replace(".layoutName", ".schemaName") as Path<FormData>;
                                    const currentSchemaName = getValues(schemaNamePath);
                                    if (currentSchemaName === undefined || currentSchemaName === "") {
                                      setValue(schemaNamePath, newValue);
                                    }
                                  }

                                  setOpen(false);
                                }}
                                value={layout.value}
                              >
                                <span className="truncate">{layout.label}</span>
                                {field.value === layout.value && <CommandCheck />}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      );
                    })()}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default LayoutSelector;
