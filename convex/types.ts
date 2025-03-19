import { v, VNull } from "convex/values";

// const deprecated = v.optional(v.any()) as unknown as VNull<unknown, "optional">;

export const vWorkflowRunState = v.object({
  value: v.record(v.string(), v.string()),
  context: v.object({
    steps: v.record(
      v.string(),
      v.object({
        status: v.union(
          v.literal("success"),
          v.literal("failed"),
          v.literal("suspended"),
          v.literal("waiting"),
          v.literal("skipped"),
        ),
        payload: v.optional(v.any()),
        error: v.optional(v.string()),
      }),
    ),
    triggerData: v.record(v.string(), v.any()),
    attempts: v.record(v.string(), v.number()),
  }),
  activePaths: v.array(
    v.object({
      stepPath: v.array(v.string()),
      stepId: v.string(),
      status: v.string(),
    }),
  ),
  runId: v.string(),
  timestamp: v.number(),
  childStates: v.optional(v.record(v.string(), v.any())), // Need to support nested states!
  /** @deprecated */
  suspendedSteps: v.optional(v.record(v.string(), v.string())),
});
