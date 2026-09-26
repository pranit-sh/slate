import type { SavedSite, SavedSiteInput } from "../../../../shared/electron-api"

export interface SavedSitesRepository {
  list(): Promise<SavedSite[]>
  create(input: SavedSiteInput): Promise<SavedSite>
  update(id: string, input: SavedSiteInput): Promise<SavedSite | null>
  delete(id: string): Promise<void>
  markOpened(id: string): Promise<SavedSite | null>
}