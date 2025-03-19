import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { vAssistantContent, vToolContent, vUserContent } from "./ai/types";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),

  // Mastra tables
  snapshots: defineTable({
    workflowName: v.string(),
    runId: v.string(),
    snapshot: v.string(), // JSON for now, later:
    updatedAt: v.number(),
  }).index("runId", ["runId", "workflowName"]),
  evals: defineTable({
    input: v.string(),
    output: v.string(),
    result: v.any(),
    agentName: v.string(),
    metricName: v.string(),
    instructions: v.string(),
    testInfo: v.optional(v.any()),
    globalRunId: v.string(),
    runId: v.string(),
  }).index("runId", ["runId", "agentName"]),
  messages: defineTable({
    id: v.string(), // TODO: can we juse the _id?
    threadId: v.string(), // TODO: can we use v.id("threads")?
    content: v.union(vUserContent, vAssistantContent, vToolContent),
    role: v.string(),
    type: v.string(),
  })
    .index("id", ["id"])
    .index("threadId", ["threadId"]),
  threads: defineTable({
    id: v.string(), // TODO: can we juse the _id?
    resourceId: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    updatedAt: v.number(),
  })
    .index("id", ["id"])
    .index("resourceId", ["resourceId"]),
  traces: defineTable({
    id: v.string(), // TODO: can we juse the _id?
    parentSpanId: v.optional(v.union(v.string(), v.null())),
    name: v.string(),
    traceId: v.string(),
    scope: v.string(),
    kind: v.number(),
    attributes: v.optional(v.any()),
    status: v.optional(v.any()),
    events: v.optional(v.any()),
    links: v.optional(v.any()),
    other: v.optional(v.string()),
    startTime: v.int64(),
    endTime: v.int64(),
  }).index("id", ["id"]),
});
