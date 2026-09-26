import { NextUpRecommendations } from "../features/next-up"
import { PinnedSitesList } from "../features/pinned-sites"
import { RecentlyClosedList } from "../features/recently-closed"

export function Home() {
  return (
    <section className="relative min-h-0 flex-1 overflow-y-auto bg-background">
      <PinnedSitesList />
      <RecentlyClosedList />
      <NextUpRecommendations />
    </section>
  )
}