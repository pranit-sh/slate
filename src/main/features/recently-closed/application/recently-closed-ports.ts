import type { RecentlyClosedPage } from "../../../../shared/electron-api"

export type RecentlyClosedPageInput = Pick<
  RecentlyClosedPage,
  "title" | "url" | "faviconUrl"
>

export interface RecentlyClosedRepository {
  list(): Promise<RecentlyClosedPage[]>
  add(page: RecentlyClosedPageInput): Promise<void>
  take(id: string): Promise<RecentlyClosedPage | null>
}