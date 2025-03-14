import { z } from "zod";
import { deepMerge } from "@mastra/core/utils";
import type { AiMessageType, CoreTool } from "@mastra/core";
import type {
  MessageType,
  MemoryConfig,
  SharedMemoryConfig,
  StorageThreadType,
} from "@mastra/core/memory";
import type { StorageGetMessagesArg } from "@mastra/core/storage";
import { embed } from "ai";
// Copied from @mastra/core/memory/memory.ts

import type {
  AssistantContent,
  ToolResultPart,
  UserContent,
  CoreToolMessage,
  ToolInvocation,
  CoreMessage,
  EmbeddingModel,
} from "ai";

import { MastraBase } from "@mastra/core/base";
import type { MastraStorage } from "@mastra/core/storage";
import type { MastraVector } from "@mastra/core/vector";
import type { MastraMemory as CoreMastraMemory } from "@mastra/core/memory";

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory extends MastraBase {
  MAX_CONTEXT_TOKENS?: number;

  storage: MastraStorage;
  vector: MastraVector;
  embedder: EmbeddingModel<string>;

  protected threadConfig: MemoryConfig = {
    lastMessages: 40,
    semanticRecall: true,
    threads: {
      generateTitle: true, // TODO: should we disable this by default to reduce latency?
    },
  };

  constructor(config: { name: string } & SharedMemoryConfig) {
    super({ component: "MEMORY", name: config.name });

    if (!config.storage) {
      throw new Error("Storage is required for the slim version");
    }
    this.storage = config.storage;

    if (!config.vector) {
      throw new Error("Vector is required for the slim version");
    }
    this.vector = config.vector;

    if (!config.embedder) {
      throw new Error("Embedder is required for the slim version");
    }
    this.embedder = config.embedder;

    if (config.options) {
      this.threadConfig = this.getMergedThreadConfig(config.options);
    }
  }

  public setStorage(storage: MastraStorage) {
    this.storage = storage;
  }

  public setVector(vector: MastraVector) {
    this.vector = vector;
  }

  public setEmbedder(embedder: EmbeddingModel<string>) {
    this.embedder = embedder;
  }

  /**
   * Get a system message to inject into the conversation.
   * This will be called before each conversation turn.
   * Implementations can override this to inject custom system messages.
   */
  public async getSystemMessage(_input: {
    threadId: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    return null;
  }

  /**
   * Get tools that should be available to the agent.
   * This will be called when converting tools for the agent.
   * Implementations can override this to provide additional tools.
   */
  public getTools(_config?: MemoryConfig): Record<string, CoreTool> {
    return {};
  }

  protected async createEmbeddingIndex(): Promise<{ indexName: string }> {
    const defaultDimensions = 1536;

    // AI SDK doesn't expose a way to check how many dimensions a model uses.
    const dimensionsByModelId: Record<string, number> = {
      "bge-small-en-v1.5": 384,
      "bge-base-en-v1.5": 768,
    };

    const dimensions =
      dimensionsByModelId[this.embedder.modelId] || defaultDimensions;
    const isDefault = dimensions === defaultDimensions;
    const indexName = isDefault
      ? "memory_messages"
      : `memory_messages_${dimensions}`;

    await this.vector.createIndex({ indexName, dimension: dimensions });
    return { indexName };
  }

  public getMergedThreadConfig(config?: MemoryConfig): MemoryConfig {
    return deepMerge(this.threadConfig, config || {});
  }

  abstract rememberMessages({
    threadId,
    resourceId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }>;

  estimateTokens(text: string): number {
    return Math.ceil(text.split(" ").length * 1.3);
  }

  protected parseMessages(messages: MessageType[]): CoreMessage[] {
    return messages.map((msg) => ({
      ...msg,
      content:
        typeof msg.content === "string" &&
        (msg.content.startsWith("[") || msg.content.startsWith("{"))
          ? JSON.parse((msg as MessageType).content as string)
          : typeof msg.content === "number"
            ? String(msg.content)
            : msg.content,
    }));
  }

  protected convertToUIMessages(messages: MessageType[]): AiMessageType[] {
    function addToolMessageToChat({
      toolMessage,
      messages,
      toolResultContents,
    }: {
      toolMessage: CoreToolMessage;
      messages: Array<AiMessageType>;
      toolResultContents: Array<ToolResultPart>;
    }): {
      chatMessages: Array<AiMessageType>;
      toolResultContents: Array<ToolResultPart>;
    } {
      const chatMessages = messages.map((message) => {
        if (message.toolInvocations) {
          return {
            ...message,
            toolInvocations: message.toolInvocations.map((toolInvocation) => {
              const toolResult = toolMessage.content.find(
                (tool) => tool.toolCallId === toolInvocation.toolCallId,
              );

              if (toolResult) {
                return {
                  ...toolInvocation,
                  state: "result",
                  result: toolResult.result,
                };
              }

              return toolInvocation;
            }),
          };
        }

        return message;
      }) as Array<AiMessageType>;

      const resultContents = [...toolResultContents, ...toolMessage.content];

      return { chatMessages, toolResultContents: resultContents };
    }

    const { chatMessages } = messages.reduce(
      (
        obj: {
          chatMessages: Array<AiMessageType>;
          toolResultContents: Array<ToolResultPart>;
        },
        message,
      ) => {
        if (message.role === "tool") {
          return addToolMessageToChat({
            toolMessage: message as CoreToolMessage,
            messages: obj.chatMessages,
            toolResultContents: obj.toolResultContents,
          });
        }

        let textContent = "";
        let toolInvocations: Array<ToolInvocation> = [];

        if (typeof message.content === "string") {
          textContent = message.content;
        } else if (typeof message.content === "number") {
          textContent = String(message.content);
        } else if (Array.isArray(message.content)) {
          for (const content of message.content) {
            if (content.type === "text") {
              textContent += content.text;
            } else if (content.type === "tool-call") {
              const toolResult = obj.toolResultContents.find(
                (tool) => tool.toolCallId === content.toolCallId,
              );
              toolInvocations.push({
                state: toolResult ? "result" : "call",
                toolCallId: content.toolCallId,
                toolName: content.toolName,
                args: content.args,
                result: toolResult?.result,
              });
            }
          }
        }

        obj.chatMessages.push({
          id: (message as MessageType).id,
          role: message.role as AiMessageType["role"],
          content: textContent,
          toolInvocations,
        });

        return obj;
      },
      { chatMessages: [], toolResultContents: [] } as {
        chatMessages: Array<AiMessageType>;
        toolResultContents: Array<ToolResultPart>;
      },
    );

    return chatMessages;
  }

  /**
   * Retrieves a specific thread by its ID
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to the thread or null if not found
   */
  abstract getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null>;

  abstract getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]>;

  /**
   * Saves or updates a thread
   * @param thread - The thread data to save
   * @returns Promise resolving to the saved thread
   */
  abstract saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType>;

  /**
   * Saves messages to a thread
   * @param messages - Array of messages to save
   * @returns Promise resolving to the saved messages
   */
  abstract saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MessageType[];
    memoryConfig: MemoryConfig | undefined;
  }): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to array of messages and uiMessages
   */
  abstract query({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }>;

  /**
   * Helper method to create a new thread
   * @param title - Optional title for the thread
   * @param metadata - Optional metadata for the thread
   * @returns Promise resolving to the created thread
   */
  async createThread({
    threadId,
    resourceId,
    title,
    metadata,
    memoryConfig,
  }: {
    resourceId: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType> {
    const thread: StorageThreadType = {
      id: threadId || this.generateId(),
      title: title || `New Thread ${new Date().toISOString()}`,
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    return this.saveThread({ thread, memoryConfig });
  }

  /**
   * Helper method to delete a thread
   * @param threadId - the id of the thread to delete
   */
  abstract deleteThread(threadId: string): Promise<void>;

  /**
   * Helper method to add a single message to a thread
   * @param threadId - The thread to add the message to
   * @param content - The message content
   * @param role - The role of the message sender
   * @param type - The type of the message
   * @param toolNames - Optional array of tool names that were called
   * @param toolCallArgs - Optional array of tool call arguments
   * @param toolCallIds - Optional array of tool call ids
   * @returns Promise resolving to the saved message
   */
  async addMessage({
    threadId,
    config,
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
    config?: MemoryConfig;
    content: UserContent | AssistantContent;
    role: "user" | "assistant";
    type: "text" | "tool-call" | "tool-result";
    toolNames?: string[];
    toolCallArgs?: Record<string, unknown>[];
    toolCallIds?: string[];
  }): Promise<MessageType> {
    const message: MessageType = {
      id: this.generateId(),
      content,
      role,
      createdAt: new Date(),
      threadId,
      type,
      toolNames,
      toolCallArgs,
      toolCallIds,
    };

    const savedMessages = await this.saveMessages({
      messages: [message],
      memoryConfig: config,
    });
    return savedMessages[0]!;
  }

  /**
   * Generates a unique identifier
   * @returns A unique string ID
   */
  public generateId(): string {
    return crypto.randomUUID();
  }
}

// Copied from @mastra/memory/src/tools/working-memory.ts
export const updateWorkingMemoryTool: CoreTool = {
  description: "Update the working memory with new information",
  parameters: z.object({
    memory: z
      .string()
      .describe("The XML-formatted working memory content to store"),
  }),
  execute: async (params: any) => {
    const { context, threadId, memory } = params;
    if (!threadId || !memory) {
      throw new Error(
        "Thread ID and Memory instance are required for working memory updates",
      );
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Update thread metadata with new working memory
    await memory.saveThread({
      thread: {
        ...thread,
        metadata: {
          ...thread.metadata,
          workingMemory: context.memory,
        },
      },
    });

    return { success: true };
  },
};

// From @mastra/memory/src/index.ts
// Modified to require storage, vector, and embedder
/**
 * Concrete implementation of MastraMemory that adds support for thread configuration
 * and message injection.
 */
export class Memory extends MastraMemory {
  constructor(config: SharedMemoryConfig = {}) {
    super({ name: "Memory", ...config });

    const mergedConfig = this.getMergedThreadConfig({
      workingMemory: config.options?.workingMemory || {
        enabled: false,
        template: this.defaultWorkingMemoryTemplate,
      },
    });
    this.threadConfig = mergedConfig;
  }

  private async validateThreadIsOwnedByResource(
    threadId: string,
    resourceId: string,
  ) {
    const thread = await this.storage.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`No thread found with id ${threadId}`);
    }
    if (thread.resourceId !== resourceId) {
      throw new Error(
        `Thread with id ${threadId} is for resource with id ${thread.resourceId} but resource ${resourceId} was queried.`,
      );
    }
  }

  async query({
    threadId,
    resourceId,
    selectBy,
    threadConfig,
  }: StorageGetMessagesArg): Promise<{
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }> {
    if (resourceId)
      await this.validateThreadIsOwnedByResource(threadId, resourceId);

    let vectorResults:
      | null
      | {
          id: string;
          score: number;
          metadata?: Record<string, any>;
          vector?: number[];
        }[] = null;

    this.logger.debug(`Memory query() with:`, {
      threadId,
      selectBy,
      threadConfig,
    });

    const config = this.getMergedThreadConfig(threadConfig || {});

    const vectorConfig =
      typeof config?.semanticRecall === `boolean`
        ? {
            topK: 2,
            messageRange: { before: 2, after: 2 },
          }
        : {
            topK: config?.semanticRecall?.topK ?? 2,
            messageRange: config?.semanticRecall?.messageRange ?? {
              before: 2,
              after: 2,
            },
          };

    if (
      config?.semanticRecall &&
      selectBy?.vectorSearchString &&
      this.vector &&
      !!selectBy.vectorSearchString
    ) {
      const { embedding } = await embed({
        value: selectBy.vectorSearchString,
        model: this.embedder,
      });

      const { indexName } = await this.createEmbeddingIndex();

      vectorResults = await this.vector.query({
        indexName,
        queryVector: embedding,
        topK: vectorConfig.topK,
        filter: {
          thread_id: threadId,
        },
      });
    }

    // Get raw messages from storage
    const rawMessages = await this.storage.__getMessages({
      threadId,
      selectBy: {
        ...selectBy,
        ...(vectorResults?.length
          ? {
              include: vectorResults.map((r) => ({
                id: r.metadata?.message_id,
                withNextMessages:
                  typeof vectorConfig.messageRange === "number"
                    ? vectorConfig.messageRange
                    : vectorConfig.messageRange.after,
                withPreviousMessages:
                  typeof vectorConfig.messageRange === "number"
                    ? vectorConfig.messageRange
                    : vectorConfig.messageRange.before,
              })),
            }
          : {}),
      },
      threadConfig: config,
    });

    // Parse and convert messages
    const messages = this.parseMessages(rawMessages);
    const uiMessages = this.convertToUIMessages(rawMessages);

    return { messages, uiMessages };
  }

  async rememberMessages({
    threadId,
    resourceId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }> {
    if (resourceId)
      await this.validateThreadIsOwnedByResource(threadId, resourceId);

    const threadConfig = this.getMergedThreadConfig(config || {});

    if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
      return {
        messages: [],
        uiMessages: [],
        threadId,
      };
    }

    const messages = await this.query({
      threadId,
      selectBy: {
        last: threadConfig.lastMessages,
        vectorSearchString:
          threadConfig.semanticRecall && vectorMessageSearch
            ? vectorMessageSearch
            : undefined,
      },
      threadConfig: config,
    });

    this.logger.debug(
      `Remembered message history includes ${messages.messages.length} messages.`,
    );
    return {
      threadId,
      messages: messages.messages,
      uiMessages: messages.uiMessages,
    };
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    return this.storage.__getThreadById({ threadId });
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    return this.storage.__getThreadsByResourceId({ resourceId });
  }

  async saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType> {
    const config = this.getMergedThreadConfig(memoryConfig || {});

    if (config.workingMemory?.enabled && !thread?.metadata?.workingMemory) {
      // if working memory is enabled but the thread doesn't have it, we need to set it
      return this.storage.__saveThread({
        thread: deepMerge(thread, {
          metadata: {
            workingMemory:
              config.workingMemory.template ||
              this.defaultWorkingMemoryTemplate,
          },
        }),
      });
    }

    return this.storage.__saveThread({ thread });
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return this.storage.__updateThread({
      id,
      title,
      metadata,
    });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.storage.__deleteThread({ threadId });

    // TODO: Also clean up vector storage if it exists
    // if (this.vector) {
    //   await this.vector.deleteThread(threadId); ?? filter by thread attributes and delete all returned messages?
    // }
  }

  async saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MessageType[];
    memoryConfig?: MemoryConfig;
  }): Promise<MessageType[]> {
    // First save working memory from any messages
    await this.saveWorkingMemory(messages);

    // Then strip working memory tags from all messages
    this.mutateMessagesToHideWorkingMemory(messages);

    const config = this.getMergedThreadConfig(memoryConfig);

    if (this.vector && config.semanticRecall) {
      const { indexName } = await this.createEmbeddingIndex();

      for (const message of messages) {
        if (typeof message.content !== `string` || message.content === "")
          continue;
        const { embedding } = await embed({
          value: message.content,
          model: this.embedder,
          maxRetries: 3,
        });
        await this.vector.upsert({
          indexName,
          vectors: [embedding],
          metadata: [
            {
              text: message.content,
              message_id: message.id,
              thread_id: message.threadId,
            },
          ],
        });
      }
    }

    return this.storage.__saveMessages({ messages });
  }

  protected mutateMessagesToHideWorkingMemory(messages: MessageType[]) {
    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;
    for (const message of messages) {
      if (typeof message?.content === `string`) {
        message.content = message.content
          .replace(workingMemoryRegex, ``)
          .trim();
      } else if (Array.isArray(message?.content)) {
        for (const content of message.content) {
          if (content.type === `text`) {
            content.text = content.text.replace(workingMemoryRegex, ``).trim();
          }
        }
      }
    }
  }

  protected parseWorkingMemory(text: string): string | null {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    const workingMemoryRegex = /<working_memory>([^]*?)<\/working_memory>/g;
    const matches = text.match(workingMemoryRegex);
    const match = matches?.[0];

    if (match) {
      return match.replace(/<\/?working_memory>/g, "").trim();
    }

    return null;
  }

  protected async getWorkingMemory({
    threadId,
  }: {
    threadId: string;
  }): Promise<string | null> {
    if (!this.threadConfig.workingMemory?.enabled) return null;

    // Get thread from storage
    const thread = await this.storage.__getThreadById({ threadId });
    if (!thread)
      return (
        this.threadConfig?.workingMemory?.template ||
        this.defaultWorkingMemoryTemplate
      );

    // Return working memory from metadata
    const memory =
      (thread.metadata?.workingMemory as string) ||
      this.threadConfig.workingMemory.template ||
      this.defaultWorkingMemoryTemplate;

    // compress working memory because LLMs will generate faster without the spaces and line breaks
    return memory
      .split(`>\n`)
      .map((c) => c.trim()) // remove extra whitespace
      .join(`>`); // and linebreaks
  }

  private async saveWorkingMemory(messages: MessageType[]) {
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || !this.threadConfig.workingMemory?.enabled) {
      return;
    }

    const latestContent = !latestMessage?.content
      ? null
      : typeof latestMessage.content === "string"
        ? latestMessage.content
        : latestMessage.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");

    const threadId = latestMessage?.threadId;
    if (!latestContent || !threadId) {
      return;
    }

    const newMemory = this.parseWorkingMemory(latestContent);
    if (!newMemory) {
      return;
    }

    const thread = await this.storage.__getThreadById({ threadId });
    if (!thread) return;

    // Update thread metadata with new working memory
    await this.storage.__updateThread({
      id: thread.id,
      title: thread.title || "",
      metadata: deepMerge(thread.metadata || {}, {
        workingMemory: newMemory,
      }),
    });
    return newMemory;
  }

  public async getSystemMessage({
    threadId,
    memoryConfig,
  }: {
    threadId: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    const config = this.getMergedThreadConfig(memoryConfig);
    if (!config.workingMemory?.enabled) {
      return null;
    }

    const workingMemory = await this.getWorkingMemory({ threadId });
    if (!workingMemory) {
      return null;
    }

    if (config.workingMemory.use === "tool-call") {
      return this.getWorkingMemoryToolInstruction(workingMemory);
    }

    return this.getWorkingMemoryWithInstruction(workingMemory);
  }

  public defaultWorkingMemoryTemplate = `
<user>
  <first_name></first_name>
  <last_name></last_name>
  <location></location>
  <occupation></occupation>
  <interests></interests>
  <goals></goals>
  <events></events>
  <facts></facts>
  <projects></projects>
</user>
`;

  private getWorkingMemoryWithInstruction(workingMemoryBlock: string) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by including "<working_memory>text</working_memory>" in your responses. Updates replace existing memory while maintaining this structure. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use nested tags for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"

Memory Structure:
<working_memory>
  ${workingMemoryBlock}
</working_memory>

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you their name or the value of another empty section in your working memory, output the <working_memory> block immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must output the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by outputting the entire "<working_memory>text</working_memory>" block in your response. The system will pick this up and store it for you. The user will not see it.
- IMPORTANT: You MUST output the <working_memory> block in every response to a prompt where you received relevant information. `;
  }

  private getWorkingMemoryToolInstruction(workingMemoryBlock: string) {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use nested XML tags for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"

Memory Structure:
${workingMemoryBlock}

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you their name or the value of another empty section in your working memory, call updateWorkingMemory immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must include the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the entire XML block. The system will store it for you. The user will not see it.
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information.`;
  }

  public getTools(config?: MemoryConfig): Record<string, CoreTool> {
    const mergedConfig = this.getMergedThreadConfig(config);
    if (
      mergedConfig.workingMemory?.enabled &&
      mergedConfig.workingMemory.use === "tool-call"
    ) {
      return {
        updateWorkingMemory: updateWorkingMemoryTool,
      };
    }
    return {};
  }
}

export function createMemory(config: SharedMemoryConfig): CoreMastraMemory {
  return new Memory(config) as unknown as CoreMastraMemory;
}
