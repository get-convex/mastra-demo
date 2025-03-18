import { PgVector } from "@mastra/pg";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { testTool } from "../tools/test";
// import { ConvexStorage } from "../../../lib/storage";

// export const storage = new ConvexStorage({ config: {} });

const connectionString =
  "postgresql://myuser:mypassword@localhost:5433/mydatabase";
const vector = new PgVector(connectionString);
const embedder = openai.embedding("text-embedding-3-small");

const memory = new Memory({
  // storage,
  vector,
  embedder,
});
export const agent = new Agent({
  name: "test",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
  tools: {
    test: testTool,
  },
  memory,
});
