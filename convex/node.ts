"use node";
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { action } from "./_generated/server";
import { Step } from "@mastra/core/workflows/step";
import { Memory } from "@mastra/memory";
import { Workflow } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { testTool } from "./notnode";
import { ConvexStorage } from "../lib/storage";

const storage = new ConvexStorage({ config: {} });

// const memory = new Memory({
//   storage,
//   vector: new Vector({}),
//   embedder: new Embedder({}),
// });

const agent = new Agent({
  name: "test",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
  tools: {
    test: testTool,
  },
  // memory,
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
    const run = workflow.createRun();
    const result = await run.start();
    console.log({ result });
    const gen = await agent.generate([
      { role: "user", content: "call the test tool" },
    ]);
  },
});
