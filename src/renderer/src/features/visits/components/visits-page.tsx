import { Fragment, useEffect, useRef, useState } from "react"
import { ArrowUpRight, Clock3, Search, SearchX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Favicon } from "@/components/favicon"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import type { Visit } from "../../../../../shared/electron-api"
import { AccordionContent, AccordionItem, AccordionTrigger, Accordion } from "@/components/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function getFaviconUrl(visit: Visit): string {
  if (visit.faviconUrl) return visit.faviconUrl
  try {
    return new URL("/favicon.ico", visit.url).toString()
  } catch {
    return ""
  }
}

function matchesSearch(visit: Visit, query: string): boolean {
  const queryTerms = query.split(/[^a-z0-9]+/).filter(Boolean)
  const visitTerms = `${visit.title} ${getHost(visit.url)}`
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  return queryTerms.every((queryTerm) =>
    visitTerms.some((visitTerm) => visitTerm.startsWith(queryTerm)),
  )
}

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00`)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date)
}

export function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [expandedDays, setExpandedDays] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const hasLoadedVisits = useRef(false)

  useEffect(() => {
    let refreshId = 0
    let isActive = true
    const refreshVisits = (): void => {
      const currentRefreshId = ++refreshId
      void window.electron.browser.getVisits().then((items) => {
        if (!isActive || currentRefreshId !== refreshId) return
        setVisits(items)
        const days = [...new Set(items.map((visit) => visit.day))]
        if (!hasLoadedVisits.current) {
          hasLoadedVisits.current = true
          setExpandedDays(days)
        } else {
          const availableDays = new Set(days)
          setExpandedDays((currentDays) => currentDays.filter((day) => availableDays.has(day)))
        }
      })
    }

    refreshVisits()
    const removeRefreshListener = window.electron.browser.onVisitsRefreshRequested(refreshVisits)
    return () => {
      isActive = false
      removeRefreshListener()
    }
  }, [])

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredVisits = normalizedQuery
    ? visits.filter((visit) => matchesSearch(visit, normalizedQuery))
    : visits
  const visitsByDay = filteredVisits.reduce<Map<string, Visit[]>>((groups, visit) => {
    const dayVisits = groups.get(visit.day) ?? []
    dayVisits.push(visit)
    groups.set(visit.day, dayVisits)
    return groups
  }, new Map())
  async function deleteVisit(visit: Visit): Promise<void> {
    await window.electron.browser.deleteVisit(visit.day, visit.url)
    setVisits((currentVisits) =>
      currentVisits.filter((item) => item.day !== visit.day || item.url !== visit.url),
    )
  }

  async function clearVisits(): Promise<void> {
    await window.electron.browser.clearVisits()
    setVisits([])
    setSearchQuery("")
  }

  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-8 py-8">
        {visits.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Clock3 />
              </EmptyMedia>
              <EmptyTitle className="font-normal">No visits yet</EmptyTitle>
              <EmptyDescription>Visited pages will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <InputGroup className="max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search visits"
                  aria-label="Search visits"
                />
              </InputGroup>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost">Clear</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear browsing history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all visits from your history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void clearVisits()}>
                      Clear history
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {filteredVisits.length === 0 ? (
              <Empty className="min-h-64">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchX />
                  </EmptyMedia>
                  <EmptyTitle className="font-normal">No matching visits</EmptyTitle>
                  <EmptyDescription>Try a different title or website.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Accordion
                type="multiple"
                value={expandedDays}
                onValueChange={setExpandedDays}
                className="overflow-hidden rounded-lg border"
              >
              {[...visitsByDay].map(([day, dayVisits]) => (
                <AccordionItem key={day} value={day}>
                  <AccordionTrigger className="rounded-none bg-muted px-4 font-normal hover:no-underline">
                    <span>{formatDay(day)}</span>
                    <span className="ml-auto font-normal text-muted-foreground">
                      {dayVisits.length} {dayVisits.length === 1 ? "page" : "pages"}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <Separator />
                    <div>
                      {dayVisits.map((visit, index) => (
                        <Fragment key={visit.url}>
                          {index > 0 && <Separator />}
                        <div
                          className="group/visit flex h-14 items-center px-3"
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 text-left font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            onClick={() => window.electron.browser.navigate(visit.url)}
                          >
                            <span className="relative size-5 shrink-0">
                              <Favicon src={getFaviconUrl(visit)} className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-normal">{visit.title}</span>
                              <span className="block truncate text-xs font-normal text-muted-foreground">
                                {getHost(visit.url)}
                              </span>
                            </span>
                          </button>
                          <span className="ml-4 flex w-20 shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                            <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover/visit:opacity-100 group-focus-within/visit:opacity-100" />
                            <span className="flex-1 text-right">
                              {visit.count} {visit.count === 1 ? "visit" : "visits"}
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="ml-3 text-muted-foreground opacity-0 hover:bg-transparent hover:text-foreground group-hover/visit:opacity-100 group-focus-within/visit:opacity-100"
                            aria-label={`Delete ${visit.title} from history`}
                            onClick={() => void deleteVisit(visit)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                        </Fragment>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </main>
  )
}