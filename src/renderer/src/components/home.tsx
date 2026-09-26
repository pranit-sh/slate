import { NextUpRecommendations } from "../features/next-up"
import { RecentlyClosedList } from "../features/recently-closed"

export function Home() {
  return (
    <section className="relative min-h-0 flex-1 overflow-y-auto bg-background">
      <RecentlyClosedList />
      <NextUpRecommendations />
    </section>
  )
}