"use node";
import { PgVector } from "@mastra/pg";
import { Mastra } from "../lib/mastra";
import { Agent } from "@mastra/core/agent";
import { action } from "./_generated/server";
import { Step } from "@mastra/core/workflows";
import { Workflow } from "@mastra/core/workflows";
import { openai } from "@ai-sdk/openai";
import { testTool } from "./notnode";
import { createMemory } from "../lib/memory";
import { ConvexStorage } from "../lib/storage";
import crypto from "crypto";

// Some of the packages look for it globally
global.crypto = crypto as any;

const storage = new ConvexStorage({ config: {} });

const connectionString =
  "postgresql://myuser:mypassword@localhost:5433/mydatabase";
const vector = new PgVector(connectionString);
const embedder = openai.embedding("text-embedding-3-small");
const memory = createMemory({
  storage,
  vector,
  embedder,
});

const agent = new Agent({
  name: "test",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
  tools: {
    test: testTool,
  },
  memory,
});

const step = new Step({
  id: "test",
  async execute(context) {
    return "test";
  },
});

const workflow = new Workflow({
  name: "test",
  retryConfig: { attempts: 2, delay: 1000 },
}).step(step);

const mastra = new Mastra({
  agents: { test: agent },
  workflows: { test: workflow },
  storage,
});

export const a = action({
  args: {},
  handler: async (ctx, args) => {
    // new Memory({} as any);

    const indexes = await vector.listIndexes();
    console.log(indexes);
    const testWorkflow = mastra.getWorkflow("test");
    const run = testWorkflow.createRun();
    const workflowResult = await run.start();
    const gen = await agent.generate([
      { role: "user", content: "call the test tool" },
    ]);
    return [{ results: workflowResult.results }, gen.response.messages];
  },
});

export const uuid = action({
  args: {},
  handler: async (ctx, args) => {
    return crypto.randomUUID();
  },
});
