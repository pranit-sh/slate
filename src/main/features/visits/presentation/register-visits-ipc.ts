import { ipcMain } from "electron"
import { IPC_CHANNELS } from "../../../../shared/electron-api"
import type { VisitHistoryService } from "../application/visit-history-service"

interface RegisterVisitsIpcOptions {
  service: VisitHistoryService
  clearDismissals(): Promise<void>
  openPage(event: Electron.IpcMainEvent): void
}

export function registerVisitsIpc({
  service,
  clearDismissals,
  openPage,
}: RegisterVisitsIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getVisits, () => service.list())
  ipcMain.handle(IPC_CHANNELS.deleteVisit, (_event, day: string, url: string) =>
    service.delete(day, url),
  )
  ipcMain.handle(IPC_CHANNELS.clearVisits, () =>
    Promise.all([service.clear(), clearDismissals()]),
  )
  ipcMain.on(IPC_CHANNELS.openVisits, openPage)
}