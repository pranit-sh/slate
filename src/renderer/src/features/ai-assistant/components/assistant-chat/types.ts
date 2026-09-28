import type { AiAgentActivity } from "../../../../../../shared/electron-api"

export type ChatMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  createdAt: number
  responseDurationMs?: number
  modelName?: string
  error?: string
  interrupted?: boolean
  replyToId?: string
  activities?: AiAgentActivity[]
}

export type ResponseStatus = "ready" | "submitted" | "streaming"
