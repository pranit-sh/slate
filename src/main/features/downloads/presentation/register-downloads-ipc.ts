import { ipcMain } from "electron"
import { IPC_CHANNELS } from "../../../../shared/electron-api"
import type { DownloadService } from "../application/download-service"

interface RegisterDownloadsIpcOptions {
  service: DownloadService
  openPage(event: Electron.IpcMainEvent): void
}

export function registerDownloadsIpc({ service, openPage }: RegisterDownloadsIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getDownloads, () => service.list())
  ipcMain.handle(IPC_CHANNELS.openDownload, (_event, id: string) => service.open(id))
  ipcMain.handle(IPC_CHANNELS.showDownloadInFolder, (_event, id: string) =>
    service.showInFolder(id),
  )
  ipcMain.handle(IPC_CHANNELS.copyDownloadLink, (_event, id: string) => service.copyLink(id))
  ipcMain.handle(IPC_CHANNELS.cancelDownload, (_event, id: string) => service.cancel(id))
  ipcMain.handle(IPC_CHANNELS.removeDownload, (_event, id: string) => service.remove(id))
  ipcMain.handle(IPC_CHANNELS.clearDownloads, () => service.clear())
  ipcMain.on(IPC_CHANNELS.openDownloads, openPage)
}