import { type MouseEvent } from "react"
import { ArrowUpRight, Clock3 } from "lucide-react"
import { Favicon } from "../../../components/favicon"
import { useRecentlyClosed } from "../hooks/use-recently-closed"

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function RecentlyClosedList() {
  const { pages, reopen } = useRecentlyClosed()

  if (pages.length === 0) return null

  function handleReopen(event: MouseEvent<HTMLButtonElement>, page: Parameters<typeof reopen>[0]) {
    reopen(page, !(event.metaKey || event.ctrlKey))
  }

  return (
    <nav
      aria-label="Recently closed pages"
      className="absolute bottom-5 left-5 w-60 overflow-hidden rounded-lg border bg-background sm:bottom-7 sm:left-8"
    >
      <div className="flex h-8 items-center gap-1.5 bg-muted px-2.5">
        <Clock3 className="size-3.5 text-muted-foreground" />
        <h2 className="text-xs font-normal">Recently closed</h2>
      </div>
      <ul className="divide-y border-t">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              onClick={(event) => handleReopen(event, page)}
              title={`Reopen ${page.title}`}
              className="group/page flex h-11 w-full min-w-0 items-center gap-2.5 px-2.5 text-left font-normal outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="relative size-4 shrink-0">
                <Favicon src={page.faviconUrl} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-normal">{page.title}</span>
                <span className="block truncate text-[10px] font-normal text-muted-foreground">
                  {getHost(page.url)}
                </span>
              </span>
              <ArrowUpRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/page:opacity-100 group-focus-visible/page:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}