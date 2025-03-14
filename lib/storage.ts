import type { MessageType, StorageThreadType } from "@mastra/core/memory/types";
import { MastraStorage } from "@mastra/core/storage";
import type { TABLE_NAMES } from "@mastra/core/storage/constants";
import type {
  EvalRow,
  StorageColumn,
  StorageGetMessagesArg,
} from "@mastra/core/storage/types";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

export type ConvexStorageConfig = {};
declare global {
  // This should be set via the Convex Mastra wrapper.
  var ctx: GenericActionCtx<GenericDataModel>;
}
/**
 * A proxy for the DefaultStorage to allow for dynamically loading the storage in a constructor
 */
export class ConvexStorage extends MastraStorage {
  storageConfig: ConvexStorageConfig;

  constructor({ config }: { config: ConvexStorageConfig }) {
    super({ name: "DefaultStorage" });
    this.shouldCacheInit = true;
    this.storageConfig = config;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // nothing to do here. tables are already in schema
    return;
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    // TODO: use action to clear table
    return;
  }

  async insert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    // TODO: use action to insert
    return;
  }

  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    // TODO: use action to batch insert
    return;
  }

  async load<R>({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    // TODO: use action to load
    return null;
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    // TODO: use action to get thread by id
    return null;
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    // TODO: use action to get threads by resource id
    return [];
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
