import { ipcMain } from "electron"
import { IPC_CHANNELS } from "../../../../shared/electron-api"
import type { BugReportService } from "../application/bug-report-service"

export function registerBugReportIpc(service: BugReportService): void {
  ipcMain.handle(IPC_CHANNELS.reportBug, () => service.open())
}