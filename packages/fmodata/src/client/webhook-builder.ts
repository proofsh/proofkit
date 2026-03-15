import { Effect } from "effect";
import { requestFromService, runAsResult, withSpan } from "../effect";
import { type FMTable, getTableName } from "../orm";
import { type Column, isColumn } from "../orm/column";
import { FilterExpression } from "../orm/operators";
import { extractConfigFromLayer, type FMODataLayer, type ODataConfig } from "../services";
import type { ExecuteMethodOptions } from "../types";
import { formatSelectFields } from "./builders/select-utils";

export interface Webhook<TableName = string> {
  webhook: string;
  headers?: Record<string, string>;
  tableName: TableName;
  notifySchemaChanges?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: Generic constraint accepting any Column configuration
  select?: string | Column<any, any, any>[];
  filter?: string | FilterExpression;
}

/**
 * Webhook information returned by the API
 */
export interface WebhookInfo {
  webhookID: number;
  tableName: string;
  webhook: string;
  headers?: Record<string, string>;
  notifySchemaChanges: boolean;
  select: string;
  filter: string;
  pendingOperations: unknown[];
}

/**
 * Response from listing all webhooks
 */
export interface WebhookListResponse {
  status: string;
  webhooks: WebhookInfo[];
}

/**
 * Response from adding a webhook
 */
export interface WebhookAddResponse {
  webhookResult: {
    webhookID: number;
  };
}

export class WebhookManager {
  private readonly layer: FMODataLayer;
  private readonly config: ODataConfig;

  constructor(layer: FMODataLayer) {
    this.layer = layer;
    this.config = extractConfigFromLayer(this.layer).config;
  }

  /**
   * Adds a new webhook to the database.
   * @param webhook - The webhook configuration object
   * @param webhook.webhook - The webhook URL to call
   * @param webhook.tableName - The FMTable instance for the table to monitor
   * @param webhook.headers - Optional custom headers to include in webhook requests
   * @param webhook.notifySchemaChanges - Whether to notify on schema changes
   * @param webhook.select - Optional field selection (string or array of Column references)
   * @param webhook.filter - Optional filter (string or FilterExpression)
   * @returns Promise resolving to the created webhook data with ID
   * @example
   * ```ts
   * const result = await db.webhook.add({
   *   webhook: "https://example.com/webhook",
   *   tableName: contactsTable,
   *   headers: { "X-Custom-Header": "value" },
   * });
   * // result.webhookResult.webhookID contains the new webhook ID
   * ```
   * @example
   * ```ts
   * // Using filter expressions and column arrays (same DX as query builder)
   * const result = await db.webhook.add({
   *   webhook: "https://example.com/webhook",
   *   tableName: contacts,
   *   filter: eq(contacts.name, "John"),
   *   select: [contacts.name, contacts.PrimaryKey],
   * });
   * ```
   */
  async add(webhook: Webhook<FMTable>, options?: ExecuteMethodOptions): Promise<WebhookAddResponse> {
    // Extract the string table name from the FMTable instance
    const tableName = getTableName(webhook.tableName);

    // Get useEntityIds setting (check options first, then config, default to false)
    const useEntityIds = options?.useEntityIds ?? this.config.useEntityIds ?? false;

    // Transform filter if it's a FilterExpression
    let filter: string | undefined;
    if (webhook.filter !== undefined) {
      if (webhook.filter instanceof FilterExpression) {
        filter = webhook.filter.toODataFilter(useEntityIds);
      } else {
        filter = webhook.filter;
      }
    }

    // Transform select if it's an array of Columns
    let select: string | undefined;
    if (webhook.select !== undefined) {
      if (Array.isArray(webhook.select)) {
        // Extract field identifiers from columns or use strings as-is
        const fieldNames = webhook.select.map((item) => {
          if (isColumn(item)) {
            return item.getFieldIdentifier(useEntityIds);
          }
          return String(item);
        });
        // Use formatSelectFields to properly format the select string
        select = formatSelectFields(fieldNames, webhook.tableName, useEntityIds);
      } else {
        // Already a string, use as-is
        select = webhook.select;
      }
    }

    // Create request body with string table name and transformed filter/select
    const requestBody: {
      webhook: string;
      headers?: Record<string, string>;
      tableName: string;
      notifySchemaChanges?: boolean;
      select?: string;
      filter?: string;
    } = {
      webhook: webhook.webhook,
      tableName,
    };

    if (webhook.headers !== undefined) {
      requestBody.headers = webhook.headers;
    }
    if (webhook.notifySchemaChanges !== undefined) {
      requestBody.notifySchemaChanges = webhook.notifySchemaChanges;
    }
    if (select !== undefined) {
      requestBody.select = select;
    }
    if (filter !== undefined) {
      requestBody.filter = filter;
    }

    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<WebhookAddResponse>(`/${this.config.databaseName}/Webhook.Add`, {
        method: "POST",
        body: JSON.stringify(requestBody),
        ...options,
      });
    });

    const result = await runAsResult(Effect.provide(withSpan(pipeline, "fmodata.webhook.add"), this.layer));
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  /**
   * Deletes a webhook by ID.
   * @param webhookId - The ID of the webhook to delete
   * @returns Promise that resolves when the webhook is deleted
   * @example
   * ```ts
   * await db.webhook.remove(1);
   * ```
   */
  async remove(webhookId: number, options?: ExecuteMethodOptions): Promise<void> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService(`/${this.config.databaseName}/Webhook.Delete(${webhookId})`, {
        method: "POST",
        ...options,
      });
    });

    const result = await runAsResult(Effect.provide(withSpan(pipeline, "fmodata.webhook.remove"), this.layer));
    if (result.error) {
      throw result.error;
    }
  }

  /**
   * Gets a webhook by ID.
   * @param webhookId - The ID of the webhook to retrieve
   * @returns Promise resolving to the webhook data
   * @example
   * ```ts
   * const webhook = await db.webhook.get(1);
   * // webhook.webhookID, webhook.tableName, webhook.webhook, etc.
   * ```
   */
  async get(webhookId: number, options?: ExecuteMethodOptions): Promise<WebhookInfo> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<WebhookInfo>(`/${this.config.databaseName}/Webhook.Get(${webhookId})`, options);
    });

    const result = await runAsResult(Effect.provide(withSpan(pipeline, "fmodata.webhook.get"), this.layer));
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  /**
   * Lists all webhooks.
   * @returns Promise resolving to webhook list response with status and webhooks array
   * @example
   * ```ts
   * const result = await db.webhook.list();
   * // result.status contains the status
   * // result.webhooks contains the array of webhooks
   * ```
   */
  async list(options?: ExecuteMethodOptions): Promise<WebhookListResponse> {
    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<WebhookListResponse>(`/${this.config.databaseName}/Webhook.GetAll`, options);
    });

    const result = await runAsResult(Effect.provide(withSpan(pipeline, "fmodata.webhook.list"), this.layer));
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  /**
   * Invokes a webhook by ID, optionally for specific row IDs.
   * @param webhookId - The ID of the webhook to invoke
   * @param options - Optional configuration
   * @param options.rowIDs - Array of row IDs to trigger the webhook for
   * @returns Promise resolving to the invocation result (type unknown until API behavior is confirmed)
   * @example
   * ```ts
   * // Invoke for all rows
   * await db.webhook.invoke(1);
   *
   * // Invoke for specific rows
   * await db.webhook.invoke(1, { rowIDs: [63, 61] });
   * ```
   */
  async invoke(
    webhookId: number,
    options?: { rowIDs?: number[] },
    executeOptions?: ExecuteMethodOptions,
  ): Promise<unknown> {
    const body: { rowIDs?: number[] } = {};
    if (options?.rowIDs !== undefined) {
      body.rowIDs = options.rowIDs;
    }

    const pipeline = Effect.gen(this, function* () {
      return yield* requestFromService<unknown>(`/${this.config.databaseName}/Webhook.Invoke(${webhookId})`, {
        method: "POST",
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        ...executeOptions,
      });
    });

    const result = await runAsResult(Effect.provide(withSpan(pipeline, "fmodata.webhook.invoke"), this.layer));
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }
}
