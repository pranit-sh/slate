import { ipcMain, type WebContents } from "electron"
import { IPC_CHANNELS, type BrowserSettings } from "../../../../shared/electron-api"
import type { BrowserSettingsService } from "../application/browser-settings-service"

interface RegisterBrowserSettingsIpcOptions {
  service: BrowserSettingsService
  onUpdated(event: { sender: WebContents }, settings: BrowserSettings): void
  openPage(event: Electron.IpcMainEvent): void
}

export function registerBrowserSettingsIpc({
  service,
  onUpdated,
  openPage,
}: RegisterBrowserSettingsIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getSettings, () => service.get())
  ipcMain.handle(IPC_CHANNELS.updateSettings, async (event, settings: BrowserSettings) => {
    const updatedSettings = await service.update(settings)
    onUpdated(event, updatedSettings)
    return updatedSettings
  })
  ipcMain.on(IPC_CHANNELS.openSettings, openPage)
}