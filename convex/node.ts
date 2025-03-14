"use node";
import { Mastra } from "@mastra/core";
import { action } from "./_generated/server";

export const a = action({
  args: {},
  handler: async (ctx, args) => {
    const mastra = new Mastra();
  },
});
export const mastra = new Mastra();
