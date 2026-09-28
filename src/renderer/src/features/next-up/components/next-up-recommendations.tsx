import { type MouseEvent } from "react"
import { Forward, X } from "lucide-react"
import type { NextUpReason, NextUpRecommendation } from "../../../../../shared/electron-api"
import { Favicon } from "../../../components/favicon"
import { useNextUp } from "../hooks/use-next-up"

const REASON_LABELS: Record<NextUpReason, string> = {
  "usual-time": "Usually around this time",
  "usual-day": "Common on this day",
  frequent: "Frequently visited",
}

export function NextUpRecommendations() {
  const { recommendations, dismiss } = useNextUp()

  if (recommendations.length === 0) return null

  function open(event: MouseEvent<HTMLButtonElement>, recommendation: NextUpRecommendation): void {
    if (event.metaKey || event.ctrlKey) {
      window.electron.browser.openUrl(recommendation.url, false)
      return
    }

    window.electron.browser.navigate(recommendation.url)
  }

  return (
    <nav
      aria-label="Next up recommendations"
      className="absolute bottom-5 right-5 w-72 overflow-hidden rounded-lg border bg-background sm:bottom-7 sm:right-8"
    >
      <div className="flex h-8 items-center gap-1.5 bg-muted px-2.5">
        <Forward className="size-3.5 text-muted-foreground" />
        <h2 className="text-xs font-normal">Next up</h2>
      </div>
      <ul className="divide-y border-t">
        {recommendations.map((recommendation) => (
          <li
            key={recommendation.id}
            className="group/recommendation flex h-12 min-w-0 items-center"
          >
            <button
              type="button"
              onClick={(event) => open(event, recommendation)}
              title={`Open ${recommendation.title}`}
              className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-2.5 text-left font-normal outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="relative size-4 shrink-0">
                <Favicon src={recommendation.faviconUrl} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-normal">
                  {recommendation.title}
                </span>
                <span className="block truncate text-[10px] font-normal text-muted-foreground">
                  {REASON_LABELS[recommendation.reason]}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => dismiss(recommendation)}
              aria-label={`Dismiss ${recommendation.title} for 7 days`}
              title="Hide for 7 days"
              className="mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/recommendation:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}