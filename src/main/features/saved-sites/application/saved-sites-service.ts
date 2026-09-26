import type { SavedSite, SavedSiteInput } from "../../../../shared/electron-api"
import type { SavedSitesRepository } from "./saved-sites-ports"

export class SavedSitesService {
  constructor(private readonly repository: SavedSitesRepository) {}

  list(): Promise<SavedSite[]> {
    return this.repository.list()
  }

  create(input: SavedSiteInput): Promise<SavedSite> {
    return this.repository.create(input)
  }

  update(id: string, input: SavedSiteInput): Promise<SavedSite | null> {
    return this.repository.update(id, input)
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id)
  }

  markOpened(id: string): Promise<SavedSite | null> {
    return this.repository.markOpened(id)
  }
}