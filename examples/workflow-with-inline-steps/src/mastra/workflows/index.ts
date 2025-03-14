import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});

myWorkflow
  .step(
    new Step({
      id: 'stepOne',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        doubledValue: z.number(),
      }),
      execute: async ({ context }) => {
        const doubledValue = context?.triggerData.inputValue * 2;
        return { doubledValue };
      },
    }),
  )
  .then(
    new Step({
      id: 'stepTwo',
      inputSchema: z.object({
        valueToIncrement: z.number(),
      }),
      outputSchema: z.object({
        incrementedValue: z.number(),
      }),
      execute: async ({ context }) => {
        if (context?.steps.stepOne.status === 'success') {
          const incrementedValue = context?.steps.stepOne.output.doubledValue + 1;
          return { incrementedValue };
        }
        return { incrementedValue: 0 };
      },
    }),
  );

myWorkflow.commit();

export { myWorkflow };
