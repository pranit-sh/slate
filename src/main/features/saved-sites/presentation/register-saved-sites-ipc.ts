import { ipcMain } from "electron"
import {
  IPC_CHANNELS,
  type BookmarkFeedback,
  type SavedSiteInput,
} from "../../../../shared/electron-api"
import type { SavedSitesService } from "../application/saved-sites-service"

interface RegisterSavedSitesIpcOptions {
  service: SavedSitesService
  openPage(event: Electron.IpcMainEvent): void
  onChanged(event: Electron.IpcMainInvokeEvent, feedback: BookmarkFeedback): void
}

export function registerSavedSitesIpc({
  service,
  openPage,
  onChanged,
}: RegisterSavedSitesIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getSavedSites, () => service.list())
  ipcMain.handle(IPC_CHANNELS.createSavedSite, async (event, site: SavedSiteInput) => {
    const savedSite = await service.create(site)
    onChanged(event, "saved")
    return savedSite
  })
  ipcMain.handle(IPC_CHANNELS.updateSavedSite, (_event, id: string, site: SavedSiteInput) =>
    service.update(id, site),
  )
  ipcMain.handle(IPC_CHANNELS.deleteSavedSite, async (event, id: string) => {
    await service.delete(id)
    onChanged(event, "removed")
  })
  ipcMain.handle(IPC_CHANNELS.markSavedSiteOpened, (_event, id: string) =>
    service.markOpened(id),
  )
  ipcMain.on(IPC_CHANNELS.openSaved, openPage)
}