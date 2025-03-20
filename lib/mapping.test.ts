import type { TABLE_NAMES as ORIGINAL_TABLE_NAMES } from "@mastra/core/storage";
import type {
  TABLE_NAMES as NEW_TABLE_NAMES,
  SerializedMessage,
  SerializedThread,
  vSerializedMessage,
  vSerializedThread,
} from "./mapping";
import { Infer } from "convex/values";

// type assertsions
const _tableNames: ORIGINAL_TABLE_NAMES = "" as NEW_TABLE_NAMES;
const _tableNames2: NEW_TABLE_NAMES = "" as ORIGINAL_TABLE_NAMES;

// type assertions both ways
const _serializedMessage: SerializedMessage = {} as Infer<
  typeof vSerializedMessage
>;
const _serializedMessage2: Infer<typeof vSerializedMessage> =
  {} as SerializedMessage;

// type assertions both ways
const _serializedThread: SerializedThread = {} as Infer<
  typeof vSerializedThread
>;
const _serializedThread2: Infer<typeof vSerializedThread> =
  {} as SerializedThread;
