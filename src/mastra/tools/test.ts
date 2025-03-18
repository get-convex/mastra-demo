import { createTool } from "@mastra/core";

export const testTool = createTool({
  id: "test",
  description: "test",
  execute: async (input, opts) => "test",
});
