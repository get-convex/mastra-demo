import {
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from "../lib/constants";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  [TABLE_WORKFLOW_SNAPSHOT]: defineTable({
    workflow_name: v.string(),
    run_id: v.string(),
    snapshot: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  [TABLE_EVALS]: defineTable({
    input: v.string(),
    output: v.string(),
    result: v.any(),
    agent_name: v.string(),
    metric_name: v.string(),
    instructions: v.string(),
    test_info: v.optional(v.any()),
    global_run_id: v.string(),
    run_id: v.string(),
    created_at: v.number(),
  }),
  [TABLE_MESSAGES]: defineTable({
    id: v.string(),
    thread_id: v.string(),
    content: v.string(),
    role: v.string(),
    type: v.string(),
    createdAt: v.number(),
  }).index("id", ["id"]),
  [TABLE_THREADS]: defineTable({
    id: v.string(),
    resourceId: v.string(),
    title: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("id", ["id"]),
  [TABLE_TRACES]: defineTable({
    id: v.string(),
    parentSpanId: v.optional(v.string()),
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
    createdAt: v.number(),
  }).index("id", ["id"]),
});
