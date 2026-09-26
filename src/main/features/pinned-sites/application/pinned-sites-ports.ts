import type { PinnedSite, PinnedSiteInput } from "../../../../shared/electron-api"

export interface PinnedSitesRepository {
  list(): Promise<PinnedSite[]>
  create(input: PinnedSiteInput): Promise<PinnedSite>
  delete(id: string): Promise<void>
}