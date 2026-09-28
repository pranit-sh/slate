import type { AiAgentActivity, AiUiBlock } from "../../../../../../shared/electron-api"

export type ChatMessagePart =
  | { type: "text"; content: string }
  | { type: "ui"; block: AiUiBlock }

export type ChatMessage = {
  id: string
  role: "assistant" | "user"
  parts: ChatMessagePart[]
  createdAt: number
  responseDurationMs?: number
  modelName?: string
  error?: string
  interrupted?: boolean
  replyToId?: string
  activities?: AiAgentActivity[]
}

export type ResponseStatus = "ready" | "submitted" | "streaming"

export function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((part): part is Extract<ChatMessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.content)
    .join("\n\n")
}
