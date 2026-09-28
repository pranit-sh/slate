import { ipcMain, type IpcMainEvent } from "electron"
import { IPC_CHANNELS, type AiMessageEvent } from "../../../../shared/electron-api"
import type { AiBrowserContext } from "../application/ai-assistant-ports"
import type { AiAssistantService } from "../application/ai-assistant-service"

interface RegisterAiAssistantIpcOptions {
  service: AiAssistantService
  getBrowserContext(event: IpcMainEvent): AiBrowserContext | undefined
}

export function registerAiAssistantIpc({
  service,
  getBrowserContext,
}: RegisterAiAssistantIpcOptions): void {
  const trackedClients = new Set<string>()

  ipcMain.on(IPC_CHANNELS.startAiMessage, (event, requestId: unknown, messages: unknown, contextTabIds: unknown) => {
    const clientId = String(event.sender.id)
    const emit = (messageEvent: AiMessageEvent): void => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.aiMessageEvent, messageEvent)
      }
    }

    if (!trackedClients.has(clientId)) {
      trackedClients.add(clientId)
      event.sender.once("destroyed", () => {
        trackedClients.delete(clientId)
        service.cancelClient(clientId)
      })
    }

    try {
      const browserContext = getBrowserContext(event)
      if (!browserContext) throw new Error("The browser context is unavailable.")
      service.start({
        clientId,
        requestId: typeof requestId === "string" ? requestId : "",
        messages,
        contextTabIds,
        browserContext,
        emit,
      })
    } catch (error) {
      if (typeof requestId === "string" && requestId.length > 0 && requestId.length <= 100) {
        emit({
          requestId,
          type: "error",
          message: error instanceof Error ? error.message : "The AI request failed.",
        })
      }
    }
  })

  ipcMain.on(IPC_CHANNELS.cancelAiMessage, (event, requestId: unknown) => {
    if (typeof requestId !== "string") return
    service.cancel(String(event.sender.id), requestId)
  })
}
