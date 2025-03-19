import { v, Validator } from "convex/values";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { TABLE_THREADS } from "@mastra/core/storage";
import { mapSerializedToMastra, SerializedThread } from "../lib/mapping";
import { StorageThreadType } from "@mastra/core";

interface StorageColumn {
  type: "text" | "timestamp" | "uuid" | "jsonb" | "integer" | "bigint";
  primaryKey?: boolean;
  nullable?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export function validateTableSchema(
  tableName: TableNames,
  tableSchema: Record<string, StorageColumn>,
) {
  if (!schema.tables[tableName]) {
    throw new Error(`Table ${tableName} not found in schema`);
  }
  const table = schema.tables[tableName];
  const fields = table.validator.fields;
  for (const [name, field] of Object.entries(tableSchema)) {
    if (!(name in fields)) {
      throw new Error(`Field ${name} not found in schema for ${tableName}`);
    }
    let convexValue: Validator<any>["kind"];
    switch (field.type) {
      case "text":
        convexValue = "string";
        break;
      case "integer":
        convexValue = "int64";
        break;
      case "bigint":
        convexValue = "int64";
        break;
      case "timestamp":
        convexValue = "int64";
        break;
      case "jsonb":
        convexValue = "any";
        break;
      case "uuid":
        convexValue = "string";
        break;
    }
    if (!convexValue) {
      throw new Error(
        `Unexpected field type ${field.type} for ${name} in ${tableName}`,
      );
    }
    const expected = fields[name as keyof typeof fields] as Validator<any, any>;
    if (expected.type !== convexValue) {
      throw new Error(
        `Field ${name} in table ${tableName} was expected to be a ${convexValue} but got ${expected.type}`,
      );
    }
    if (expected.isOptional === "required" && field.nullable) {
      throw new Error(
        `Field ${name} in table ${tableName} was expected to be required but the schema specified nullable`,
      );
    }
  }
}

export const insert = internalMutation({
  args: {
    tableName: v.string(),
    document: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert(args.tableName as any, args.document);
  },
});

export const batchInsert = internalMutation({
  args: {
    tableName: v.string(),
    records: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await Promise.all(
      args.records.map(async (record) => {
        await ctx.db.insert(args.tableName as any, record);
      }),
    );
  },
});

export const load = internalQuery({
  args: {
    tableName: v.string(),
    keys: v.any(),
  },
  handler: async (ctx, args) => {
    throw new Error(
      `Not implemented: load for ${args.tableName}: ${JSON.stringify(args.keys)}`,
    );
  },
});

export const clearTable = internalAction({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    while (true) {
      cursor = await ctx.scheduler.runAfter(0, internal.lib.clearPage, {
        tableName: args.tableName,
        cursor,
      });
      if (!cursor) {
        break;
      }
    }
  },
});

export const clearPage = internalMutation({
  args: { tableName: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<string | null> => {
    const page = await ctx.db.query(args.tableName as any).paginate({
      numItems: 1000,
      cursor: args.cursor ?? null,
    });
    await Promise.all(
      page.page.map(async (item) => {
        await ctx.db.delete(item._id);
      }),
    );
    if (!page.isDone) {
      return page.continueCursor;
    }
    return null;
  },
});

function threadToSerializedMastra(thread: Doc<"threads">): SerializedThread {
  const { id, title, metadata, resourceId, createdAt, updatedAt } = thread;
  return { id, title, metadata, resourceId, createdAt, updatedAt };
}

export const getThreadById = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("id", (q) => q.eq("id", args.threadId))
      .unique();
    if (!thread) {
      return null;
    }
    return threadToSerializedMastra(thread);
  },
});
