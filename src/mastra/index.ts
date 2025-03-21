import { Mastra } from "@mastra/core/mastra";
import { Step } from "@mastra/core/workflows";
import { Workflow } from "@mastra/core/workflows";
import { agent } from "./agents/test";

const step = new Step({
  id: "test",
  async execute(context) {
    const gen = await agent.generate([
      { role: "user", content: "call the test tool" },
    ]);
    return gen.response.messages.at(-1)?.content;
  },
});

const workflow = new Workflow({
  name: "test",
  retryConfig: { attempts: 2, delay: 1000 },
}).step(step);

export const mastra = new Mastra({
  telemetry: {
    enabled: false,
  },
  agents: { test: agent },
  workflows: { test: workflow },
});
