import type { AiChatMessage, AiMessageEvent } from "../../../../shared/electron-api"
import type {
  AiAgentRunner,
  AiBrowserContext,
  AiCredentialsProvider,
} from "./ai-assistant-ports"

const MAX_MESSAGES = 40
const MAX_CONTEXT_TABS = 100
const MAX_IDENTIFIER_LENGTH = 100

type AiMessageEventPayload<Event = AiMessageEvent> = Event extends AiMessageEvent
  ? Omit<Event, "requestId">
  : never

export interface StartAiAssistantRequest {
  clientId: string
  requestId: string
  messages: unknown
  contextTabIds: unknown
  browserContext: AiBrowserContext
  emit(event: AiMessageEvent): void
}

export class AiAssistantService {
  private readonly requests = new Map<string, AbortController>()

  constructor(
    private readonly credentialsProvider: AiCredentialsProvider,
    private readonly runAgent: AiAgentRunner,
  ) {}

  start(request: StartAiAssistantRequest): void {
    const requestId = validateIdentifier(request.requestId, "request")
    const messages = validateMessages(request.messages)
    const contextTabIds = validateContextTabIds(request.contextTabIds)
    const requestKey = this.getRequestKey(request.clientId, requestId)

    this.requests.get(requestKey)?.abort()
    const controller = new AbortController()
    this.requests.set(requestKey, controller)

    void this.execute(
      requestKey,
      requestId,
      messages,
      contextTabIds,
      request,
      controller,
    )
  }

  cancel(clientId: string, requestId: string): void {
    if (!isValidIdentifier(requestId)) return
    this.requests.get(this.getRequestKey(clientId, requestId))?.abort()
  }

  cancelClient(clientId: string): void {
    const prefix = `${clientId}:`
    for (const [requestKey, controller] of this.requests) {
      if (!requestKey.startsWith(prefix)) continue
      controller.abort()
      this.requests.delete(requestKey)
    }
  }

  private async execute(
    requestKey: string,
    requestId: string,
    messages: AiChatMessage[],
    contextTabIds: string[],
    request: StartAiAssistantRequest,
    controller: AbortController,
  ): Promise<void> {
    const emit = (event: AiMessageEventPayload): void => {
      if (!controller.signal.aborted) request.emit({ requestId, ...event } as AiMessageEvent)
    }

    try {
      const credentials = await this.credentialsProvider.getActiveCredentials()
      await this.runAgent(
        credentials,
        messages,
        request.browserContext,
        contextTabIds,
        {
          onActivity: (activity) => emit({ type: "activity", activity }),
          onChunk: (content) => {
            if (content) emit({ type: "chunk", content })
          },
        },
        controller.signal,
      )
      emit({ type: "done" })
    } catch (error) {
      emit({
        type: "error",
        message: error instanceof Error ? error.message : "The AI request failed.",
      })
    } finally {
      if (this.requests.get(requestKey) === controller) this.requests.delete(requestKey)
    }
  }

  private getRequestKey(clientId: string, requestId: string): string {
    return `${clientId}:${requestId}`
  }
}

function validateMessages(value: unknown): AiChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    throw new Error("The conversation must contain between 1 and 40 messages.")
  }
  if (value.some((message) => !isAiChatMessage(message))) {
    throw new Error("The conversation contains an invalid message.")
  }
  return value
}

function isAiChatMessage(value: unknown): value is AiChatMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Partial<AiChatMessage>
  return (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string"
}

function validateContextTabIds(value: unknown): string[] {
  if (
    !Array.isArray(value)
    || value.length > MAX_CONTEXT_TABS
    || value.some((tabId) => !isValidIdentifier(tabId))
  ) {
    throw new Error("The selected page context is invalid.")
  }
  return value
}

function validateIdentifier(value: unknown, label: string): string {
  if (!isValidIdentifier(value)) throw new Error(`The ${label} ID is invalid.`)
  return value
}

function isValidIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH
}