"use node";
export * as libsql from "@libsql/client";
import { TABLE_NAMES } from "./schema";
import { TABLE_NAMES as STORAGE_TABLE_NAMES } from "@mastra/core/storage";

const _typeAssertion: STORAGE_TABLE_NAMES = "" as STORAGE_TABLE_NAMES;
const _otherAssertion: TABLE_NAMES = "" as STORAGE_TABLE_NAMES;
