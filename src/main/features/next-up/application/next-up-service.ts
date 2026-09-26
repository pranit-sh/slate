import type { NextUpRecommendation } from "../../../../shared/electron-api"
import { getNextUpRecommendations } from "../domain/recommendation-engine"
import type {
  NextUpDismissalRepository,
  UrlReader,
  VisitReader,
} from "./next-up-ports"

interface NextUpServiceDependencies {
  visits: VisitReader
  pinnedSites: UrlReader
  recentlyClosed: UrlReader
  dismissals: NextUpDismissalRepository
}

export interface GetNextUpRecommendationsInput {
  openUrls?: Iterable<string>
  now?: Date
  limit?: number
}

export class NextUpService {
  constructor(private readonly dependencies: NextUpServiceDependencies) {}

  async getRecommendations(
    input: GetNextUpRecommendationsInput = {},
  ): Promise<NextUpRecommendation[]> {
    const [visits, pinnedSites, recentlyClosed, dismissedIds] = await Promise.all([
      this.dependencies.visits.list(),
      this.dependencies.pinnedSites.list(),
      this.dependencies.recentlyClosed.list(),
      this.dependencies.dismissals.list(input.now),
    ])

    return getNextUpRecommendations(visits, {
      now: input.now,
      limit: input.limit,
      excludedUrls: [
        ...(input.openUrls ?? []),
        ...pinnedSites.map((site) => site.url),
        ...recentlyClosed.map((page) => page.url),
      ],
      dismissedIds,
    })
  }

  dismiss(id: string): Promise<void> {
    return this.dependencies.dismissals.dismiss(id)
  }

  clearDismissals(): Promise<void> {
    return this.dependencies.dismissals.clear()
  }
}