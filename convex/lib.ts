import { v, Validator } from "convex/values";
import schema from "./schema";
import { internal } from "./_generated/api";
import { Doc, TableNames } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  SerializedMessage,
  SerializedThread,
  vSerializedMessage,
  vSerializedThread,
} from "../lib/mapping";

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
    // TODO: split out into inserts per usecase and enforce unique constraints
    await ctx.db.insert(args.tableName as any, args.document);
  },
  returns: v.null(),
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
  returns: v.null(),
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
  returns: v.union(v.any(), v.null()),
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
  returns: v.null(),
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
  returns: v.union(v.string(), v.null()),
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
  returns: v.union(vSerializedThread, v.null()),
});

export const getThreadsByResourceId = internalQuery({
  args: {
    resourceId: v.string(),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    threads: SerializedThread[];
    continueCursor: string;
    isDone: boolean;
  }> => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("resourceId", (q) => q.eq("resourceId", args.resourceId))
      .paginate({
        numItems: 100,
        cursor: args.cursor ?? null,
      });
    return {
      threads: threads.page.map(threadToSerializedMastra),
      continueCursor: threads.continueCursor,
      isDone: threads.isDone,
    };
  },
  returns: v.object({
    threads: v.array(vSerializedThread),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
});

export const saveThread = internalMutation({
  args: { thread: vSerializedThread },
  handler: async (ctx, args) => {
    await ctx.db.insert("threads", args.thread);
  },
  returns: v.null(),
});

export const updateThread = internalMutation({
  args: {
    threadId: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("id", (q) => q.eq("id", args.threadId))
      .unique();
    if (!thread) {
      throw new Error(`Thread ${args.threadId} not found`);
    }
    if (args.title) {
      await ctx.db.patch(thread._id, { title: args.title });
    }
    if (args.metadata) {
      await ctx.db.patch(thread._id, { metadata: args.metadata });
    }
    return threadToSerializedMastra(thread);
  },
  returns: vSerializedThread,
});

export const deleteThread = internalMutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("id", (q) => q.eq("id", args.threadId))
      .unique();
    if (!thread) {
      throw new Error(`Thread ${args.threadId} not found`);
    }
    await ctx.db.delete(thread._id);
  },
  returns: v.null(),
});

// const vMemoryConfig = v.object({
//   lastMessages: v.optional(v.union(v.number(), v.literal(false))),
//   semanticRecall: v.optional(
//     v.union(
//       v.boolean(),
//       v.object({
//         topK: v.number(),
//         messageRange: v.union(
//           v.number(),
//           v.object({ before: v.number(), after: v.number() }),
//         ),
//       }),
//     ),
//   ),
//   workingMemory: v.optional(
//     v.object({
//       enabled: v.boolean(),
//       template: v.optional(v.string()),
//       use: v.optional(
//         v.union(v.literal("text-stream"), v.literal("tool-call")),
//       ),
//     }),
//   ),
//   threads: v.optional(
//     v.object({
//       generateTitle: v.optional(v.boolean()),
//     }),
//   ),
// });
const vSelectBy = v.object({
  vectorSearchString: v.optional(v.string()),
  last: v.optional(v.union(v.number(), v.literal(false))),
  include: v.optional(
    v.array(
      v.object({
        id: v.string(),
        withPreviousMessages: v.optional(v.number()),
        withNextMessages: v.optional(v.number()),
      }),
    ),
  ),
});

function messageToSerializedMastra(
  message: Doc<"messages">,
): SerializedMessage {
  const { threadOrder, _id, _creationTime, ...serialized } = message;
  return serialized;
}

const DEFAULT_MESSAGES_LIMIT = 40; // What pg & upstash do too.

export const getMessagesPage = internalQuery({
  args: {
    threadId: v.string(),
    selectBy: v.optional(vSelectBy),
    // Unimplemented and as far I can tell no storage provider has either.
    // memoryConfig: v.optional(vMemoryConfig),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(args.selectBy?.last ? args.selectBy.last : DEFAULT_MESSAGES_LIMIT);

    const handled: boolean[] = [];
    const toFetch: number[] = [];
    for (const m of messages) {
      handled[m.threadOrder] = true;
    }
    await Promise.all(
      args.selectBy?.include?.map(async (range) => {
        const includeDoc = await ctx.db
          .query("messages")
          .withIndex("id", (q) => q.eq("id", range.id))
          .unique();
        if (!includeDoc) {
          console.warn(`Message ${range.id} not found`);
          return;
        }
        if (!range.withPreviousMessages && !range.withNextMessages) {
          messages.push(includeDoc);
          return;
        }
        const order = includeDoc.threadOrder;
        for (
          let i = order - (range.withPreviousMessages ?? 0);
          i < order + (range.withNextMessages ?? 0);
          i++
        ) {
          if (!handled[i]) {
            toFetch.push(i);
            handled[i] = true;
          }
        }
      }) ?? [],
    );
    // sort and find unique numbers in toFetch
    const uniqueToFetch = [...new Set(toFetch)].sort();
    // find contiguous ranges in uniqueToFetch
    const ranges: { start: number; end: number }[] = [];
    for (let i = 0; i < uniqueToFetch.length; i++) {
      const start = uniqueToFetch[i];
      let end = start;
      while (i + 1 < uniqueToFetch.length && uniqueToFetch[i + 1] === end + 1) {
        end++;
        i++;
      }
      ranges.push({ start, end });
    }
    const fetched = (
      await Promise.all(
        ranges.map(async (range) => {
          return await ctx.db
            .query("messages")
            .withIndex("threadId", (q) =>
              q
                .eq("threadId", args.threadId)
                .gte("threadOrder", range.start)
                .lte("threadOrder", range.end),
            )
            .collect();
        }),
      )
    ).flat();
    messages.push(...fetched);
    return messages.map(messageToSerializedMastra);
  },
  returns: v.array(vSerializedMessage),
});

export const saveMessages = internalMutation({
  args: { messages: v.array(vSerializedMessage) },
  handler: async (ctx, args) => {
    const messagesByThreadId: Record<string, SerializedMessage[]> = {};
    for (const message of args.messages) {
      messagesByThreadId[message.threadId] = [
        ...(messagesByThreadId[message.threadId] ?? []),
        message,
      ];
    }
    for (const threadId in messagesByThreadId) {
      const lastMessage = await ctx.db
        .query("messages")
        .withIndex("threadId", (q) => q.eq("threadId", threadId))
        .order("desc")
        .first();
      let threadOrder = lastMessage?.threadOrder ?? 0;
      for (const message of messagesByThreadId[threadId]) {
        threadOrder++;
        await ctx.db.insert("messages", {
          ...message,
          threadOrder,
        });
      }
    }
  },
  returns: v.null(),
});

export const getEvalsByAgentName = internalQuery({
  args: {
    agentName: v.string(),
    type: v.optional(v.union(v.literal("test"), v.literal("live"))),
  },
  handler: async (ctx, args) => {
    const evals = await ctx.db
      .query("evals")
      .withIndex("agentName", (q) => {
        const byAgent = q.eq("agentName", args.agentName);
        if (args.type === "test") {
          return byAgent.gt("testInfo.testPath", null);
        } else if (args.type === "live") {
          return byAgent.lte("testInfo.testPath", null);
        }
        return byAgent;
      })
      .collect();
    return evals.map((e) => {
      const { _id, _creationTime, ...serialized } = e;
      return serialized;
    });
  },
  returns: v.array(schema.tables.evals.validator),
});

const MAX_TRACES_SCANNED = 4096;
export const getTracesPage = internalQuery({
  args: {
    name: v.optional(v.string()),
    scope: v.optional(v.string()),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
    attributes: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const { scope, name, cursor, numItems, attributes } = args;
    const overfetch = (scope ? 1 : 8) * (name ? 1 : 8);
    const results = await (
      scope
        ? ctx.db.query("traces").withIndex("scope", (q) => q.eq("scope", scope))
        : name
          ? ctx.db
              .query("traces")
              .withIndex("name", (q) =>
                q.gte("name", name).lt("name", name + "~"),
              )
          : ctx.db.query("traces")
    ).paginate({
      numItems: Math.min(numItems * overfetch, MAX_TRACES_SCANNED),
      cursor: cursor,
    });

    return {
      isDone: results.isDone,
      continuCursor: results.continueCursor,
      page: results.page
        .filter(
          (trace) =>
            (!name || trace.name.startsWith(name)) &&
            (!scope || trace.scope === scope) &&
            (!attributes ||
              Object.entries(attributes).every(
                ([key, value]) =>
                  // @ts-ignore
                  trace[key as any] === value,
              )),
        )
        .map((t) => {
          const { _id, _creationTime, ...serialized } = t;
          return serialized;
        }),
    };
  },
  returns: v.object({
    isDone: v.boolean(),
    continuCursor: v.string(),
    page: v.array(schema.tables.traces.validator),
  }),
});
