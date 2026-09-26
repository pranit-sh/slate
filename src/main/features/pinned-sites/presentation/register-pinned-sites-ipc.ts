import { ipcMain } from "electron"
import { IPC_CHANNELS, type PinnedSiteInput } from "../../../../shared/electron-api"
import type { PinnedSitesService } from "../application/pinned-sites-service"

interface RegisterPinnedSitesIpcOptions {
  service: PinnedSitesService
  onPinnedSitesChanged(): Promise<void>
}

export function registerPinnedSitesIpc(options: RegisterPinnedSitesIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getPinnedSites, () => options.service.list())
  ipcMain.handle(IPC_CHANNELS.createPinnedSite, async (_event, input: PinnedSiteInput) => {
    const site = await options.service.create(input)
    await options.onPinnedSitesChanged()
    return site
  })
  ipcMain.handle(IPC_CHANNELS.deletePinnedSite, async (_event, id: string) => {
    await options.service.delete(id)
    await options.onPinnedSitesChanged()
  })
}