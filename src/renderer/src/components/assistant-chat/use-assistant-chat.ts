import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type {
  AiAgentActivity,
  AiModel,
  AiSettings,
} from "../../../../shared/electron-api"
import type { ChatMessage, ResponseStatus } from "./types"

const EMPTY_AI_SETTINGS: AiSettings = { activeModelId: null, models: [] }

interface ActiveRequest {
  requestId: string
  messageId: string
  userMessageId: string
  modelName: string
  startedAt: number
}

export interface UseAssistantChat {
  messages: ChatMessage[]
  responseStatus: ResponseStatus
  agentActivity: AiAgentActivity | null
  isResponding: boolean
  aiSettings: AiSettings
  activeModel: AiModel | undefined
  sendMessage: (content: string) => void
  selectModel: (modelId: string) => void
  stopResponse: () => void
  retryResponse: (messageId: string) => void
  resetConversation: () => void
}

/**
 * Owns the assistant conversation state and the streaming lifecycle:
 * request tracking, incremental chunk accumulation, cancellation, and
 * synchronization with AI settings changes from the main process.
 */
export function useAssistantChat(): UseAssistantChat {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [responseStatus, setResponseStatus] = useState<ResponseStatus>("ready")
  const [agentActivity, setAgentActivity] = useState<AiAgentActivity | null>(null)
  const [aiSettings, setAiSettings] = useState(EMPTY_AI_SETTINGS)
  const activeRequestRef = useRef<ActiveRequest | null>(null)

  const isResponding = responseStatus !== "ready"
  const activeModel = useMemo(
    () => aiSettings.models.find((model) => model.id === aiSettings.activeModelId),
    [aiSettings],
  )

  const appendToActiveMessage = useCallback((text: string) => {
    const request = activeRequestRef.current
    if (!request) return
    setMessages((current) => {
      const existingMessage = current.find((message) => message.id === request.messageId)
      if (existingMessage) {
        return current.map((message) =>
          message.id === request.messageId
            ? { ...message, content: message.content + text }
            : message,
        )
      }
      return [
        ...current,
        {
          id: request.messageId,
          role: "assistant",
          content: text,
          createdAt: Date.now(),
          modelName: request.modelName,
          replyToId: request.userMessageId,
        },
      ]
    })
  }, [])

  const cancelActiveRequest = useCallback(() => {
    const request = activeRequestRef.current
    if (request) window.electron.browser.cancelAiMessage(request.requestId)
    activeRequestRef.current = null
  }, [])

  useEffect(() => {
    void window.electron.browser.getAiSettings().then((settings) => {
      setAiSettings(settings)
    })
    const removeSettingsListener = window.electron.browser.onAiSettingsChanged(setAiSettings)
    const removeMessageListener = window.electron.browser.onAiMessageEvent((event) => {
      const request = activeRequestRef.current
      if (!request || event.requestId !== request.requestId) return

      if (event.type === "activity") {
        if (event.activity.id) {
          setAgentActivity(null)
          setMessages((current) => {
            const messageIndex = current.findIndex((message) => message.id === request.messageId)
            if (messageIndex >= 0) {
              return current.map((message) =>
                message.id !== request.messageId
                  ? message
                  : {
                      ...message,
                      activities: message.activities?.some(
                        (activity) => activity.id === event.activity.id,
                      )
                        ? message.activities.map((activity) =>
                            activity.id === event.activity.id ? event.activity : activity,
                          )
                        : [...(message.activities ?? []), event.activity],
                    },
              )
            }
            return [
              ...current,
              {
                id: request.messageId,
                role: "assistant",
                content: "",
                createdAt: Date.now(),
                modelName: request.modelName,
                replyToId: request.userMessageId,
                activities: [event.activity],
              },
            ]
          })
        } else {
          setAgentActivity(event.activity)
        }
        return
      }

      if (event.type === "chunk") {
        setResponseStatus("streaming")
        setAgentActivity(null)
        appendToActiveMessage(event.content)
        return
      }

      if (event.type === "error") {
        setMessages((current) => {
          const existingMessage = current.some((message) => message.id === request.messageId)
          if (existingMessage) {
            return current.map((message) =>
              message.id === request.messageId
                ? {
                    ...message,
                    error: event.message,
                    responseDurationMs: performance.now() - request.startedAt,
                    activities: message.activities?.map((activity) =>
                      activity.status === "active"
                        ? { ...activity, status: "failed" as const }
                        : activity,
                    ),
                  }
                : message,
            )
          }
          return [
            ...current,
            {
              id: request.messageId,
              role: "assistant",
              content: "",
              createdAt: Date.now(),
              modelName: request.modelName,
              error: event.message,
              replyToId: request.userMessageId,
            },
          ]
        })
        activeRequestRef.current = null
        setResponseStatus("ready")
        setAgentActivity(null)
        return
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === request.messageId
            ? { ...message, responseDurationMs: performance.now() - request.startedAt }
            : message,
        ),
      )
      activeRequestRef.current = null
      setResponseStatus("ready")
      setAgentActivity(null)
    })

    return () => {
      removeSettingsListener()
      removeMessageListener()
      cancelActiveRequest()
    }
  }, [appendToActiveMessage, cancelActiveRequest])

  const messagesRef = useRef<ChatMessage[]>(messages)
  messagesRef.current = messages

  const sendMessage = useCallback(
    (rawContent: string) => {
      const content = rawContent.trim()
      if (!content || activeRequestRef.current || !activeModel) return

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: Date.now(),
      }

      const nextMessages = [...messagesRef.current, userMessage]
      const requestId = crypto.randomUUID()
      activeRequestRef.current = {
        requestId,
        messageId: crypto.randomUUID(),
        userMessageId: userMessage.id,
        modelName: activeModel.name,
        startedAt: performance.now(),
      }
      setMessages(nextMessages)
      setResponseStatus("submitted")
      setAgentActivity({
        state: "understanding",
        label: "Thinking",
        status: "active",
      })
      window.electron.browser.startAiMessage(
        requestId,
        nextMessages
          .filter((message) => !message.error)
          .map(({ role, content: messageContent }) => ({ role, content: messageContent })),
      )
    },
    [activeModel],
  )

  const selectModel = useCallback((modelId: string) => {
    void window.electron.browser.setActiveAiModel(modelId).then(setAiSettings)
  }, [])

  const stopResponse = useCallback(() => {
    const request = activeRequestRef.current
    if (request) {
      window.electron.browser.cancelAiMessage(request.requestId)
      setMessages((current) => {
        const responseDurationMs = performance.now() - request.startedAt
        const existingMessage = current.some((message) => message.id === request.messageId)
        if (existingMessage) {
          return current.map((message) =>
            message.id === request.messageId
              ? {
                  ...message,
                  responseDurationMs,
                  interrupted: true,
                  activities: message.activities?.map((activity) =>
                    activity.status === "active"
                      ? { ...activity, status: "cancelled" as const }
                      : activity,
                  ),
                }
              : message,
          )
        }
        return [
          ...current,
          {
            id: request.messageId,
            role: "assistant",
            content: "",
            createdAt: Date.now(),
            responseDurationMs,
            modelName: request.modelName,
            interrupted: true,
            replyToId: request.userMessageId,
          },
        ]
      })
    }
    activeRequestRef.current = null
    setResponseStatus("ready")
    setAgentActivity(null)
  }, [])

  const retryResponse = useCallback((messageId: string) => {
    if (activeRequestRef.current || !activeModel) return

    const failedMessage = messagesRef.current.find((message) => message.id === messageId)
    const userMessageIndex = messagesRef.current.findIndex(
      (message) => message.id === failedMessage?.replyToId,
    )
    if (userMessageIndex < 0) return

    const nextMessages = messagesRef.current.slice(0, userMessageIndex + 1)
    const userMessage = nextMessages[userMessageIndex]
    const requestId = crypto.randomUUID()
    activeRequestRef.current = {
      requestId,
      messageId: crypto.randomUUID(),
      userMessageId: userMessage.id,
      modelName: activeModel.name,
      startedAt: performance.now(),
    }
    setMessages(nextMessages)
    setResponseStatus("submitted")
    setAgentActivity({
      state: "understanding",
      label: "Thinking",
      status: "active",
    })
    window.electron.browser.startAiMessage(
      requestId,
      nextMessages
        .filter((message) => !message.error)
        .map(({ role, content }) => ({ role, content })),
    )
  }, [activeModel])

  const resetConversation = useCallback(() => {
    cancelActiveRequest()
    setMessages([])
    setResponseStatus("ready")
    setAgentActivity(null)
  }, [cancelActiveRequest])

  return {
    messages,
    responseStatus,
    agentActivity,
    isResponding,
    aiSettings,
    activeModel,
    sendMessage,
    selectModel,
    stopResponse,
    retryResponse,
    resetConversation,
  }
}
