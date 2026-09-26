import type { PinnedSite, PinnedSiteInput } from "../../../../shared/electron-api"
import type { PinnedSitesRepository } from "./pinned-sites-ports"

export class PinnedSitesService {
  constructor(private readonly repository: PinnedSitesRepository) {}

  list(): Promise<PinnedSite[]> {
    return this.repository.list()
  }

  create(input: PinnedSiteInput): Promise<PinnedSite> {
    return this.repository.create(input)
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id)
  }
}