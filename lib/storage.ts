import type { MessageType, StorageThreadType } from "@mastra/core";
import type {
  EvalRow,
  StorageColumn,
  StorageGetMessagesArg,
} from "@mastra/core/storage";
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_NAMES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from "@mastra/core/storage";
import { internal } from "../convex/_generated/api";
import { ActionCtx } from "../convex/_generated/server";
import {
  mapSerializedToMastra,
  mapMastraToSerialized,
  mastraToConvexTableNames,
  SerializedThread,
  SerializedMessage,
  SerializedTrace,
} from "./mapping";

export type ConvexStorageConfig = {
  ctx: ActionCtx;
};

export class ConvexStorage extends MastraStorage {
  ctx: ActionCtx;

  constructor({ config }: { config: ConvexStorageConfig }) {
    super({ name: "DefaultStorage" });
    this.shouldCacheInit = true;
    this.ctx = config.ctx;
  }

  async createTable({
    tableName,
    schema: tableSchema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const convexTableName = mastraToConvexTableNames[tableName];
    if (!convexTableName) {
      throw new Error(`Unsupported table name: ${tableName}`);
    }
    // TODO: we could do more serious validation against the defined schema
    // validateTableSchema(convexTableName, tableSchema);
    return;
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.ctx.runAction(internal.lib.clearTable, { tableName });
    return;
  }

  async insert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    const convexRecord = mapMastraToSerialized(tableName, record);
    await this.ctx.runMutation(internal.lib.insert, {
      tableName,
      document: convexRecord,
    });
    return;
  }

  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    await this.ctx.runMutation(internal.lib.batchInsert, {
      tableName,
      records: records.map((record) =>
        mapMastraToSerialized(tableName, record),
      ),
    });
    return;
  }

  async load<R>({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    return await this.ctx.runQuery(internal.lib.load, {
      tableName,
      keys,
    });
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    const thread = await this.ctx.runQuery(internal.lib.getThreadById, {
      threadId,
    });
    if (!thread) {
      return null;
    }
    return mapSerializedToMastra(TABLE_THREADS, thread);
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    const threads: SerializedThread[] = [];
    let cursor: string | null = null;
    while (true) {
      const page: {
        threads: SerializedThread[];
        continueCursor: string;
        isDone: boolean;
      } = await this.ctx.runQuery(internal.lib.getThreadsByResourceId, {
        resourceId,
        cursor,
      });
      threads.push(...page.threads);
      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }
    return threads.map((thread) =>
      mapSerializedToMastra(TABLE_THREADS, thread),
    );
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType;
  }): Promise<StorageThreadType> {
    await this.ctx.runMutation(internal.lib.saveThread, {
      thread: mapMastraToSerialized(TABLE_THREADS, thread),
    });
    return thread;
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread = await this.ctx.runMutation(internal.lib.updateThread, {
      threadId: id,
      title,
      metadata,
    });
    return mapSerializedToMastra(TABLE_THREADS, thread);
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.ctx.runMutation(internal.lib.deleteThread, { threadId });
    return;
  }

  async getMessages<T extends MessageType>({
    threadId,
    selectBy,
  }: StorageGetMessagesArg): Promise<T[]> {
    const messages: SerializedMessage[] = await this.ctx.runQuery(
      internal.lib.getMessagesPage,
      {
        threadId,
        selectBy,
        // memoryConfig: threadConfig,
      },
    );
    return messages.map((message) =>
      mapSerializedToMastra(TABLE_MESSAGES, message),
    ) as T[];
  }

  async saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]> {
    await this.ctx.runMutation(internal.lib.saveMessages, {
      messages: messages.map((message) =>
        mapMastraToSerialized(TABLE_MESSAGES, message),
      ),
    });
    return messages;
  }

  async getEvalsByAgentName(
    agentName: string,
    type?: "test" | "live",
  ): Promise<EvalRow[]> {
    const evals = await this.ctx.runQuery(internal.lib.getEvalsByAgentName, {
      agentName,
      type,
    });
    return evals.map((e) => mapSerializedToMastra(TABLE_EVALS, e));
  }

  async getTraces(options?: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    const { name, scope, page, perPage, attributes } = options ?? {};
    const traces: SerializedTrace[] = [];
    let cursor: string | null = null;
    const numItems = perPage ?? 100;
    const pageNum = page ?? 0;
    while (true) {
      const results: {
        isDone: boolean;
        continuCursor: string;
        page: SerializedTrace[];
      } = await this.ctx.runQuery(internal.lib.getTracesPage, {
        name,
        scope,
        cursor,
        numItems,
        attributes,
      });
      traces.push(...results.page);
      // Note: we'll refetch from the beginning on every page.
      if (results.isDone || traces.length >= numItems * pageNum) {
        break;
      }
    }
    return traces
      .slice(pageNum * numItems, (pageNum + 1) * numItems)
      .map((trace) => mapSerializedToMastra(TABLE_TRACES, trace));
  }
}
