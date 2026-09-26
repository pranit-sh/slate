import type { RecentlyClosedPage } from "../../../../shared/electron-api"
import type {
  RecentlyClosedPageInput,
  RecentlyClosedRepository,
} from "./recently-closed-ports"

export class RecentlyClosedService {
  constructor(private readonly repository: RecentlyClosedRepository) {}

  list(): Promise<RecentlyClosedPage[]> {
    return this.repository.list()
  }

  record(page: RecentlyClosedPageInput): Promise<void> {
    return this.repository.add(page)
  }

  takeForReopen(id: string): Promise<RecentlyClosedPage | null> {
    return this.repository.take(id)
  }
}