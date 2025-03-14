"use node";
import { Mastra } from "../mastra-clone/packages/core/src/mastra/index";
import { Agent } from "../mastra-clone/packages/core/src/agent/index";
import { action } from "./_generated/server";
import { Step } from "../mastra-clone/packages/core/src/workflows/step";
import { Memory } from "../mastra-clone/packages/memory/src/index";

export const a = action({
  args: {},
  handler: async (ctx, args) => {
    new Mastra({} as any);
    new Agent({} as any);
    new Step({} as any);
    new Memory({} as any);
    new DefaultProxyStorage({} as any);
  },
});
