"use node";
// import { PgVector } from "@mastra/pg";
import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";
import { action } from "./_generated/server";
import { Step } from "@mastra/core/workflows";
import { Workflow } from "@mastra/core/workflows";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { InMemoryStorage } from "../lib/in-memory-storage";
import { InMemoryVector } from "../lib/in-memory-vector";
import { z } from "zod";
import crypto from "crypto";
import { createTool } from "@mastra/core/tools";
import { v } from "convex/values";
import { step3 } from "./notnode";

// // Some of the packages look for it globally
global.crypto = crypto as any;

const storage = new InMemoryStorage();
const vector = new InMemoryVector();

// const connectionString =
//   "postgresql://myuser:mypassword@localhost:5433/mydatabase";
// const vector = new PgVector(connectionString);
const embedder = openai.embedding("text-embedding-3-small");
const memory = new Memory({
  storage,
  vector,
  embedder,
});

export const testTool = createTool({
  id: "test",
  description: "test",
  execute: async (input, opts) => "test",
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
  inputSchema: z.object({
    content: z.string(),
  }),
  outputSchema: z.object({
    foo: z.union([z.string(), z.array(z.any())]).optional(),
    boo: z.optional(z.string()),
  }),
  async execute(context) {
    const { content } = context.context.inputData;
    const gen = await agent.generate([
      { role: "user", content: "call the test tool" },
    ]);
    return {
      foo: gen.response.messages.at(-1)?.content,
    };
  },
});

const step2 = new Step({
  id: "test2",
  inputSchema: z.object({
    bar: z.string(),
  }),
  outputSchema: z.string(),
  async execute(context) {
    const { content } = context.context.inputData;
    const fromTest = context.context.getStepResult("test");
    return content;
  },
});

// You could also import a workflow from mastra/src
const workflow = new Workflow({
  name: "test",
  retryConfig: { attempts: 2, delay: 1000 },
})
  .step(step, {
    variables: {
      content: { step: "trigger", path: "." },
    },
  })
  .then(step2, {
    variables: {
      bar: { step, path: "boo" },
    },
  })
  .step(step3);

// NOTE: we don't import the other Mastra, since it might be using storage
// we don't support. In the future we'll hopefully have an isomorphic client
// that will work in `mastra dev` as a client to Convex, and in `convex dev`
// that talks to the Component directly
const mastra = new Mastra({
  agents: { test: agent },
  workflows: { test: workflow },
  storage,
});

export const a = action({
  args: {},
  handler: async (ctx, args) => {
    const testFromMastra = mastra.getWorkflow("test");
    const run = testFromMastra.createRun();
    const workflowResult = await run.start({
      triggerData: { content: "call the test tool" },
    });
    // const gen = await agent.generate([
    //   { role: "user", content: "call the test tool" },
    // ]);
    return [{ results: workflowResult.results }];
  },
});
