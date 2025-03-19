import type { MessageType, StorageThreadType, WorkflowRow } from "@mastra/core";
import type { EvalRow } from "@mastra/core/storage";
import {
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_NAMES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from "@mastra/core/storage";
import type { AssistantContent, ToolContent, UserContent } from "ai";
import { WithoutSystemFields } from "convex/server";
import { Infer } from "convex/values";
import { Doc } from "../convex/_generated/dataModel";
import {
  vAssistantContent,
  vToolContent,
  vUserContent,
} from "../convex/ai/types";

// Define the runtime constants first
export const mastraToConvexTableNames = {
  [TABLE_WORKFLOW_SNAPSHOT]: "snapshots",
  [TABLE_EVALS]: "evals",
  [TABLE_MESSAGES]: "messages",
  [TABLE_THREADS]: "threads",
  [TABLE_TRACES]: "traces",
} as const;

export const convexToMastraTableNames = {
  snapshots: TABLE_WORKFLOW_SNAPSHOT,
  evals: TABLE_EVALS,
  messages: TABLE_MESSAGES,
  threads: TABLE_THREADS,
  traces: TABLE_TRACES,
} as const;

// Then derive the types from the constants
export type MastraToConvexTableMap = typeof mastraToConvexTableNames;
export type ConvexToMastraTableMap = typeof convexToMastraTableNames;

// Helper types to get table names
export type ConvexTableName<T extends TABLE_NAMES> = MastraToConvexTableMap[T];
export type MastraTableName<T extends keyof ConvexToMastraTableMap> =
  ConvexToMastraTableMap[T];

// Type that maps Mastra table names to their row types
export type MastraRowTypeMap = {
  [TABLE_WORKFLOW_SNAPSHOT]: WorkflowRow;
  [TABLE_EVALS]: EvalRow;
  [TABLE_MESSAGES]: MessageType;
  [TABLE_THREADS]: StorageThreadType;
  [TABLE_TRACES]: any; // Replace with proper type when available
};

// Type that maps Convex table names to their document types
export type ConvexDocTypeMap = {
  snapshots: WithoutSystemFields<Doc<"snapshots">>;
  evals: WithoutSystemFields<Doc<"evals">>;
  messages: WithoutSystemFields<Doc<"messages">>;
  threads: WithoutSystemFields<Doc<"threads">>;
  traces: WithoutSystemFields<Doc<"traces">>;
};

/**
 * Maps a Mastra row to a Convex document
 * @param tableName Mastra table name
 * @param mastraRow Row data from Mastra
 * @returns Properly typed Convex document
 */
export function mapMastraToConvexSchema<T extends TABLE_NAMES>(
  tableName: T,
  schema: MastraRowTypeMap[T],
): ConvexDocTypeMap[ConvexTableName<T>] {
  switch (tableName) {
    case TABLE_WORKFLOW_SNAPSHOT: {
      const d = {
        workflowName: schema.workflow_name,
        runId: schema.run_id,
        snapshot: JSON.stringify(schema.snapshot),
        updatedAt: Number(schema.updated_at),
      };
      return d as ConvexDocTypeMap[ConvexTableName<T>];
    }
    case TABLE_EVALS:
      return {
        input: schema.input,
        output: schema.output,
        result: schema.result,
        agentName: schema.agentName,
        metricName: schema.metricName,
        instructions: schema.instructions,
        testInfo: schema.testInfo,
        globalRunId: schema.globalRunId,
        runId: schema.runId,
      } as ConvexDocTypeMap[ConvexTableName<T>];
    case TABLE_MESSAGES:
      return {
        id: schema.id,
        threadId: schema.threadId,
        content: mapContentToConvex(schema.content),
        role: schema.role,
        type: schema.type,
      } as ConvexDocTypeMap[ConvexTableName<T>];
    case TABLE_THREADS:
      return {
        id: schema.id,
        title: schema.title,
        metadata: schema.metadata,
        resourceId: schema.resourceId,
        updatedAt: Number(schema.createdAt),
      } as ConvexDocTypeMap[ConvexTableName<T>];
    case TABLE_TRACES:
      return {
        id: schema.id,
        parentSpanId: schema.parentSpanId,
        name: schema.name,
        traceId: schema.traceId,
        scope: schema.scope,
        kind: schema.kind,
        attributes: schema.attributes,
        status: schema.status,
        events: schema.events,
        links: schema.links,
        other: schema.other,
        startTime: schema.startTime,
        endTime: schema.endTime,
      } as ConvexDocTypeMap[ConvexTableName<T>];
    default:
      throw new Error(`Unsupported table name: ${tableName}`);
  }
}

export function mapContentToConvex(
  content: UserContent | AssistantContent | ToolContent,
):
  | Infer<typeof vUserContent>
  | Infer<typeof vAssistantContent>
  | Infer<typeof vToolContent> {
  return JSON.stringify(content);
}

/**
 * Maps a Convex document to a Mastra row
 * @param tableName Mastra table name
 * @param convexDoc Document data from Convex
 * @returns Properly typed Mastra row
 */
export function mapConvexToMastraSchema<T extends TABLE_NAMES>(
  tableName: T,
  convexDoc: ConvexDocTypeMap[ConvexTableName<T>],
): MastraRowTypeMap[T] {
  switch (tableName) {
    case TABLE_WORKFLOW_SNAPSHOT: {
      const workflowDoc = convexDoc as ConvexDocTypeMap["snapshots"];
      return {
        workflow_name: workflowDoc.workflowName,
        run_id: workflowDoc.runId,
        snapshot: JSON.parse(workflowDoc.snapshot),
      } as MastraRowTypeMap[T];
    }
    case TABLE_EVALS: {
      const evalDoc = convexDoc as ConvexDocTypeMap["evals"];
      return {
        input: evalDoc.input,
        output: evalDoc.output,
        result: evalDoc.result,
        agentName: evalDoc.agentName,
        metricName: evalDoc.metricName,
        instructions: evalDoc.instructions,
        testInfo: evalDoc.testInfo,
        globalRunId: evalDoc.globalRunId,
        runId: evalDoc.runId,
      } as MastraRowTypeMap[T];
    }
    case TABLE_MESSAGES: {
      const messageDoc = convexDoc as ConvexDocTypeMap["messages"];
      return {
        id: messageDoc.id,
        threadId: messageDoc.threadId,
        content:
          typeof messageDoc.content === "string"
            ? JSON.parse(messageDoc.content)
            : messageDoc.content,
        role: messageDoc.role,
        type: messageDoc.type,
        createdAt: new Date(),
      } as MastraRowTypeMap[T];
    }
    case TABLE_THREADS: {
      const threadDoc = convexDoc as ConvexDocTypeMap["threads"];
      return {
        id: threadDoc.id,
        title: threadDoc.title,
        metadata: threadDoc.metadata,
        resourceId: threadDoc.resourceId,
        createdAt: new Date(threadDoc.updatedAt),
        updatedAt: new Date(threadDoc.updatedAt),
      } as MastraRowTypeMap[T];
    }
    case TABLE_TRACES: {
      const traceDoc = convexDoc as ConvexDocTypeMap["traces"];
      return {
        id: traceDoc.id,
        parentSpanId: traceDoc.parentSpanId,
        name: traceDoc.name,
        traceId: traceDoc.traceId,
        scope: traceDoc.scope,
        kind: traceDoc.kind,
        attributes: traceDoc.attributes,
        status: traceDoc.status,
        events: traceDoc.events,
        links: traceDoc.links,
        other: traceDoc.other,
        startTime: traceDoc.startTime,
        endTime: traceDoc.endTime,
      } as MastraRowTypeMap[T];
    }
    default:
      throw new Error(`Unsupported table name: ${tableName}`);
  }
}
