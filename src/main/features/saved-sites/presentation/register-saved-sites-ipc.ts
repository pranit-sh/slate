import { ipcMain } from "electron"
import { IPC_CHANNELS, type SavedSiteInput } from "../../../../shared/electron-api"
import type { SavedSitesService } from "../application/saved-sites-service"

interface RegisterSavedSitesIpcOptions {
  service: SavedSitesService
  openPage(event: Electron.IpcMainEvent): void
}

export function registerSavedSitesIpc({ service, openPage }: RegisterSavedSitesIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getSavedSites, () => service.list())
  ipcMain.handle(IPC_CHANNELS.createSavedSite, (_event, site: SavedSiteInput) =>
    service.create(site),
  )
  ipcMain.handle(IPC_CHANNELS.updateSavedSite, (_event, id: string, site: SavedSiteInput) =>
    service.update(id, site),
  )
  ipcMain.handle(IPC_CHANNELS.deleteSavedSite, (_event, id: string) => service.delete(id))
  ipcMain.handle(IPC_CHANNELS.markSavedSiteOpened, (_event, id: string) =>
    service.markOpened(id),
  )
  ipcMain.on(IPC_CHANNELS.openSaved, openPage)
}