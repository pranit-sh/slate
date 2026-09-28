import { ipcMain } from "electron"
import {
  type AddressBarFeedback,
  IPC_CHANNELS,
  type PinnedSiteInput,
} from "../../../../shared/electron-api"
import type { PinnedSitesService } from "../application/pinned-sites-service"

interface RegisterPinnedSitesIpcOptions {
  service: PinnedSitesService
  onPinnedSitesChanged(): Promise<void>
  onChanged(event: Electron.IpcMainInvokeEvent, feedback: AddressBarFeedback): void
}

export function registerPinnedSitesIpc(options: RegisterPinnedSitesIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getPinnedSites, () => options.service.list())
  ipcMain.handle(IPC_CHANNELS.createPinnedSite, async (event, input: PinnedSiteInput) => {
    const site = await options.service.create(input)
    await options.onPinnedSitesChanged()
    options.onChanged(event, "site-pinned")
    return site
  })
  ipcMain.handle(IPC_CHANNELS.deletePinnedSite, async (event, id: string) => {
    await options.service.delete(id)
    await options.onPinnedSitesChanged()
    options.onChanged(event, "site-unpinned")
  })
}