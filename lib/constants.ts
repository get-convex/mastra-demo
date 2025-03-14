import type { TABLE_NAMES } from "@mastra/core/storage";

export const TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot";
export const TABLE_EVALS = "mastra_evals";
export const TABLE_MESSAGES = "mastra_messages";
export const TABLE_THREADS = "mastra_threads";
export const TABLE_TRACES = "mastra_traces";
export type { TABLE_NAMES };

type _OURS =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_EVALS
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES;
const _typeAssertion: _OURS = "" as TABLE_NAMES;
const _otherAssertion: TABLE_NAMES = "" as _OURS;
