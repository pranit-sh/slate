import { ipcMain } from "electron"
import { IPC_CHANNELS, type SaveAiModelInput } from "../../../../shared/electron-api"
import type { AiModelService } from "../application/ai-model-service"

export function registerAiModelIpc(service: AiModelService): void {
  ipcMain.handle(IPC_CHANNELS.getAiSettings, () => service.get())
  ipcMain.handle(IPC_CHANNELS.saveAiModel, (_event, model: SaveAiModelInput) =>
    service.save(model),
  )
  ipcMain.handle(IPC_CHANNELS.deleteAiModel, (_event, id: string) => service.delete(id))
  ipcMain.handle(IPC_CHANNELS.setActiveAiModel, (_event, id: string) => service.setActive(id))
  ipcMain.handle(IPC_CHANNELS.testAiModelConnection, (_event, id: string) =>
    service.testModelConnection(id),
  )
}