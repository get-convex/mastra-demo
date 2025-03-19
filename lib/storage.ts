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
    // TODO: use action to save thread
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
    // TODO: use action to update thread
    return {
      id,
      title,
      metadata,
      resourceId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // TODO: use action to delete thread
    return;
  }

  async getMessages<T extends MessageType[]>({
    threadId,
    selectBy,
  }: StorageGetMessagesArg): Promise<T> {
    // TODO: use action to get messages
    return [] as unknown as T;
  }

  async saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]> {
    // TODO: use action to save messages
    return messages;
  }

  async getEvalsByAgentName(
    agentName: string,
    type?: "test" | "live",
  ): Promise<EvalRow[]> {
    // TODO: use action to get evals by agent name
    return [];
  }

  async getTraces(options?: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    // TODO: use action to get traces
    return [];
  }
}

/**
 * InMemoryStorage is a simple in-memory storage implementation for Mastra.
 * It is used for testing and development purposes.
 */
type Row = Record<string, any>;
export class InMemoryStorage extends MastraStorage {
  private tables: Record<TABLE_NAMES, Row[]> = {
    [TABLE_WORKFLOW_SNAPSHOT]: [],
    [TABLE_EVALS]: [],
    [TABLE_MESSAGES]: [],
    [TABLE_THREADS]: [],
    [TABLE_TRACES]: [],
  };
  private primaryKeys: Record<TABLE_NAMES, string | null> = {
    [TABLE_WORKFLOW_SNAPSHOT]: null,
    [TABLE_EVALS]: null,
    [TABLE_MESSAGES]: null,
    [TABLE_THREADS]: null,
    [TABLE_TRACES]: null,
  };
  constructor() {
    super({ name: "InMemoryStorage" });
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }) {
    for (const [key, value] of Object.entries(schema)) {
      if (value.primaryKey) {
        this.primaryKeys[tableName] = key;
      }
      break;
    }
    return;
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }) {
    this.tables[tableName] = [];
  }

  // We make this a non-async function so all inserts can happen transactionally
  _insert(tableName: TABLE_NAMES, record: Record<string, any>) {
    if (this.primaryKeys[tableName]) {
      const primaryKey = record[this.primaryKeys[tableName]!];
      const index = this.tables[tableName].findIndex(
        (record) => record[this.primaryKeys[tableName]!] === primaryKey,
      );
      if (index !== -1) {
        this.tables[tableName][index] = record;
      } else {
        this.tables[tableName].push(record);
      }
    } else {
      this.tables[tableName].push(record);
    }
  }

  async insert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }) {
    this._insert(tableName, record);
  }

  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }) {
    records.forEach((record) => this._insert(tableName, record));
  }

  async load<R>({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    return this.tables[tableName].find((record) =>
      Object.entries(keys).every(([key, value]) => record[key] === value),
    ) as R | null;
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    return this.tables[TABLE_THREADS].find(
      (record) => record.id === threadId,
    ) as StorageThreadType | null;
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    return this.tables[TABLE_THREADS].filter(
      (record) => record.resourceId === resourceId,
    ) as StorageThreadType[];
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType;
  }): Promise<StorageThreadType> {
    this._insert(TABLE_THREADS, thread);
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
    const index = this.tables[TABLE_THREADS].findIndex(
      (record) => record.id === id,
    );
    if (index === -1) {
      throw new Error(`Thread with id ${id} not found`);
    }
    this.tables[TABLE_THREADS][index] = {
      ...this.tables[TABLE_THREADS][index],
      title,
      metadata,
    };
    return this.tables[TABLE_THREADS][index] as StorageThreadType;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const index = this.tables[TABLE_THREADS].findIndex(
      (record) => record.id === threadId,
    );
    if (index !== -1) {
      this.tables[TABLE_THREADS].splice(index, 1);
    }
  }

  async getMessages<T extends MessageType[]>({
    threadId,
    selectBy,
  }: StorageGetMessagesArg): Promise<T> {
    const allMessages = this.tables[TABLE_MESSAGES].filter(
      (record) => record.threadId === threadId,
    ) as MessageType[];
    const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;
    const ranges = [
      { start: allMessages.length - limit, end: allMessages.length },
    ];
    if (selectBy?.include?.length) {
      ranges.push(
        ...selectBy.include
          .map((i) => {
            const index = allMessages.findIndex((record) => record.id === i.id);
            return index !== -1
              ? {
                  start: index - (i.withPreviousMessages || 0),
                  end: index + (i.withNextMessages || 0),
                }
              : null;
          })
          .flatMap((r) => (r ? [r] : [])),
      );
    }
    const indexes = ranges
      .flatMap((r) =>
        Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start + i),
      )
      .sort()
      .reduce(
        (acc, index) => (acc.at(-1) === index ? acc : [...acc, index]),
        [] as number[],
      );
    return indexes
      .map((index) => allMessages[index]!)
      .map((m) => ({
        ...m,
        content: tryJSONParse(m.content),
        createdAt: new Date(m.createdAt),
      })) as T;
  }

  async saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]> {
    messages.forEach((message) =>
      this._insert(TABLE_MESSAGES, {
        id: message.id,
        threadId: message.threadId,
        content:
          typeof message.content === "object"
            ? JSON.stringify(message.content)
            : message.content,
        role: message.role,
        type: message.type,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : message.createdAt || new Date().toISOString(),
      }),
    );
    return messages;
  }

  async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    const { name, scope, page, perPage, attributes } = args;
    const limit = perPage;
    const offset = page * perPage;
    const traces = this.tables[TABLE_TRACES].filter((record) => {
      if (name && !record.name.startsWith(name)) {
        return false;
      }
      if (scope && record.scope !== scope) {
        return false;
      }
      if (attributes) {
        return Object.keys(attributes).every(
          (key) => record.attributes[key] === attributes[key],
        );
      }
      return true;
    });
    return traces.slice(offset, offset + limit);
  }

  async getEvalsByAgentName(
    agentName: string,
    type?: "test" | "live",
  ): Promise<EvalRow[]> {
    return this.tables[TABLE_EVALS].filter(
      (record) =>
        record.agentName === agentName &&
        (type === "test"
          ? record.testInfo && record.testInfo.testPath
          : type === "live"
            ? !record.testInfo || !record.testInfo.testPath
            : true),
    ) as EvalRow[];
  }
}

function tryJSONParse(content: any) {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
