import { Workflow } from "@mastra/core";
import type { Mastra } from "@mastra/core/mastra";
import { createTool } from "@mastra/core/tools";
import type {
  StepAction,
  RetryConfig,
  StepExecutionContext,
} from "@mastra/core/workflows";
import { z } from "zod";

export const testTool = createTool({
  id: "test",
  description: "test",
  execute: async (input, opts) => "test",
});

export class ConvexStep<
  TStepId extends string = any,
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends
    StepExecutionContext<TSchemaIn> = StepExecutionContext<TSchemaIn>,
> implements StepAction<TStepId, TSchemaIn, TSchemaOut, TContext>
{
  id: TStepId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: TSchemaIn extends z.ZodSchema
    ? Partial<z.infer<TSchemaIn>>
    : unknown;
  execute: (
    context: TContext,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  retryConfig?: RetryConfig;
  mastra?: Mastra;

  constructor({
    id,
    description,
    execute,
    payload,
    outputSchema,
    inputSchema,
    retryConfig,
  }: StepAction<TStepId, TSchemaIn, TSchemaOut, TContext>) {
    this.id = id;
    this.description = description ?? "";
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.execute = execute;
    this.retryConfig = retryConfig;
  }
}

export const step3 = new ConvexStep({
  id: "test3",
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
