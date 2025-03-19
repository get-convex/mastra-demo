import type {
  DataContent,
  FilePart,
  ImagePart,
  TextPart,
  ToolCallPart,
  ToolContent,
  UserContent,
} from "ai";
import { Infer, v, VNull } from "convex/values";

// const deprecated = v.optional(v.any()) as unknown as VNull<unknown, "optional">;

const ProviderOptions = v.record(v.string(), v.record(v.string(), v.any()));

export function dataContentToConvex(data: DataContent): string | ArrayBuffer {
  if (data instanceof Uint8Array) {
    return Buffer.from(data).toString("base64");
  }
  return data;
}

export function imagePartFromConvex(part: Infer<typeof vImagePart>): ImagePart {
  if (typeof part.image === "string" && part.image.includes("://")) {
    return {
      ...part,
      image: new URL(part.image),
    };
  }
  return part;
}

export function imagePartToConvex(part: ImagePart): Infer<typeof vImagePart> {
  const image =
    part.image instanceof URL
      ? part.image.toString()
      : dataContentToConvex(part.image);
  return {
    ...part,
    image,
  };
}

export type SerializeUrlsAndUint8Arrays<T> = T extends URL
  ? string
  : T extends Uint8Array | ArrayBufferLike
    ? ArrayBuffer
    : T extends Array<infer Inner>
      ? Array<SerializeUrlsAndUint8Arrays<Inner>>
      : T extends Record<string, any>
        ? { [K in keyof T]: SerializeUrlsAndUint8Arrays<T[K]> }
        : T;

const vTextPart = v.object({
  type: v.literal("text"),
  text: v.string(),
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});
// type assertion
const _textPart: Infer<typeof vTextPart> =
  {} as SerializeUrlsAndUint8Arrays<TextPart>;

const vImagePart = v.object({
  type: v.literal("image"),
  image: v.union(v.string(), v.bytes()),
  mimeType: v.optional(v.string()),
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});
// type assertion
const _imagePart: Infer<typeof vImagePart> =
  {} as SerializeUrlsAndUint8Arrays<ImagePart>;

const vFilePart = v.object({
  type: v.literal("file"),
  data: v.union(v.string(), v.bytes()),
  mimeType: v.string(),
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});
// type assertion
const _filePart: Infer<typeof vFilePart> =
  {} as SerializeUrlsAndUint8Arrays<FilePart>;

export const vUserContent = v.union(
  v.string(),
  v.array(v.union(vTextPart, vImagePart, vFilePart)),
);
// type assertion
const _userContent: Infer<typeof vUserContent> =
  [] as SerializeUrlsAndUint8Arrays<UserContent>;

const vReasoningPart = v.object({
  type: v.literal("reasoning"),
  text: v.string(),
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});

const vRedactedReasoningPart = v.object({
  type: v.literal("redacted-reasoning"),
  data: v.string(),
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});

const vToolCallPart = v.object({
  type: v.literal("tool-call"),
  toolCallId: v.string(),
  toolName: v.string(),
  args: v.any(), // TODO: need to be optional?
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});
// type assertion
const _toolCallPart: Infer<typeof vToolCallPart> = {} as ToolCallPart;
const _toolCallPart2: ToolCallPart = {} as Infer<typeof vToolCallPart>;

export const vAssistantContent = v.union(
  v.string(),
  v.array(
    v.union(vTextPart, vReasoningPart, vRedactedReasoningPart, vToolCallPart),
  ),
);

const vToolResultContent = v.array(
  v.union(
    v.object({
      type: v.literal("text"),
      text: v.string(),
    }),
    v.object({
      type: v.literal("image"),
      data: v.string(),
      mimeType: v.optional(v.string()),
    }),
  ),
);

const vToolResultPart = v.object({
  type: v.literal("tool-result"),
  toolCallId: v.string(),
  toolName: v.string(),
  result: v.any(),
  experimental_content: v.optional(vToolResultContent),
  isError: v.optional(v.boolean()),
  providerOptions: v.optional(ProviderOptions),
  experimental_providerMetadata: v.optional(ProviderOptions),
});
export const vToolContent = v.array(vToolResultPart);
// type assertion
const _toolContent: Infer<typeof vToolContent> = [] as ToolContent;
const _toolContent2: ToolContent = [] as Infer<typeof vToolContent>;
