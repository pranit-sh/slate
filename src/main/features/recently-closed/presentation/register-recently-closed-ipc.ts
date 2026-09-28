import { ipcMain, type IpcMainEvent } from "electron"
import { IPC_CHANNELS } from "../../../../shared/electron-api"
import type { RecentlyClosedService } from "../application/recently-closed-service"

interface RegisterRecentlyClosedIpcOptions {
  service: RecentlyClosedService
  openPage(event: IpcMainEvent, url: string, active: boolean): void
  onRecentlyClosedChanged(): Promise<void>
}

export function registerRecentlyClosedIpc(options: RegisterRecentlyClosedIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getRecentlyClosed, () => options.service.list())
  ipcMain.on(IPC_CHANNELS.reopenRecentlyClosed, (event, id: string, active: unknown) => {
    void options.service.takeForReopen(id).then(async (page) => {
      if (!page) return
      options.openPage(event, page.url, active !== false)
      await options.onRecentlyClosedChanged()
    }).catch((error) => console.error("Failed to reopen recently closed page", error))
  })
}