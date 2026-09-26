import { ipcMain, type IpcMainInvokeEvent } from "electron"
import { IPC_CHANNELS } from "../../../../shared/electron-api"
import type { NextUpService } from "../application/next-up-service"

interface RegisterNextUpIpcOptions {
  service: NextUpService
  getOpenUrls(event: IpcMainInvokeEvent): string[]
  onRecommendationsChanged(): Promise<void>
}

export function registerNextUpIpc(options: RegisterNextUpIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getNextUpRecommendations, (event) =>
    options.service.getRecommendations({ openUrls: options.getOpenUrls(event) }),
  )
  ipcMain.handle(IPC_CHANNELS.dismissNextUpRecommendation, async (_event, id: string) => {
    await options.service.dismiss(id)
    await options.onRecommendationsChanged()
  })
}