import { getRandomImage } from "@/lib/mastra/system-tools";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getRandomImageTool = createTool({
  id: "Get a random image from unsplash",
  description: "Gets a random image from unsplash based on the selected option",
  inputSchema: z.object({
    query: z.enum(["wildlife", "feathers", "flying", "birds"]),
  }),
  execute: async ({ context }) => {
    return getRandomImage(context);
  },
});
