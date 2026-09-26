import { type ComponentProps, Fragment, useEffect, useState } from "react"
import { ArrowUpRight, Bookmark, Plus, Search, SearchX, X } from "lucide-react"
import { Favicon } from "@/components/favicon"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import type { SavedSite, SavedSiteInput } from "../../../../../shared/electron-api"

const EMPTY_SITE: SavedSiteInput = { title: "", url: "" }

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function sortSites(sites: SavedSite[]): SavedSite[] {
  return [...sites].sort((left, right) => {
    const openedComparison = (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? "")
    return openedComparison || right.updatedAt.localeCompare(left.updatedAt)
  })
}

function formatLastOpened(lastOpenedAt: string | null, now: number): string {
  if (!lastOpenedAt) return "Never opened"
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(lastOpenedAt).getTime()) / 60_000))
  if (elapsedMinutes < 1) return "Just now"
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} hr ago`

  const elapsedDays = Math.floor(elapsedHours / 24)
  return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`
}

export function SavedSitesPage() {
  const [sites, setSites] = useState<SavedSite[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [draft, setDraft] = useState<SavedSiteInput>(EMPTY_SITE)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let refreshId = 0
    let isActive = true
    const refreshSites = (): void => {
      const currentRefreshId = ++refreshId
      void window.electron.browser.getSavedSites().then((items) => {
        if (isActive && currentRefreshId === refreshId) setSites(sortSites(items))
      })
    }

    refreshSites()
    const removeRefreshListener = window.electron.browser.onSavedSitesRefreshRequested(refreshSites)
    return () => {
      isActive = false
      removeRefreshListener()
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredSites = normalizedQuery
    ? sites.filter((site) => `${site.title} ${getHost(site.url)}`.toLocaleLowerCase().includes(normalizedQuery))
    : sites

  function openAddDialog(): void {
    setDraft(EMPTY_SITE)
    setError("")
    setIsDialogOpen(true)
  }

  const saveSite: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault()
    setError("")
    try {
      const savedSite = await window.electron.browser.createSavedSite(draft)
      setSites((currentSites) =>
        sortSites([savedSite, ...currentSites]),
      )
      setIsDialogOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this bookmark")
    }
  }

  async function deleteSite(site: SavedSite): Promise<void> {
    await window.electron.browser.deleteSavedSite(site.id)
    setSites((currentSites) => currentSites.filter((item) => item.id !== site.id))
  }

  async function openSite(site: SavedSite): Promise<void> {
    const openedSite = await window.electron.browser.markSavedSiteOpened(site.id)
    if (openedSite) {
      setSites((currentSites) =>
        sortSites([openedSite, ...currentSites.filter((item) => item.id !== openedSite.id)]),
      )
    }
    window.electron.browser.navigate(site.url)
  }

  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-8 py-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <InputGroup className="max-w-sm">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search bookmarks"
              aria-label="Search bookmarks"
            />
          </InputGroup>
          <Button size="sm" onClick={openAddDialog}>
            <Plus /> Add bookmark
          </Button>
        </div>

        {sites.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Bookmark /></EmptyMedia>
              <EmptyTitle className="font-normal">No bookmarks</EmptyTitle>
              <EmptyDescription>Bookmark useful pages to keep them close at hand.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filteredSites.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
              <EmptyTitle className="font-normal">No matching bookmarks</EmptyTitle>
              <EmptyDescription>Try a different title or website.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {filteredSites.map((site, index) => (
              <Fragment key={site.id}>
                {index > 0 && <Separator />}
                <div className="group/site flex h-14 items-center px-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => void openSite(site)}
                >
                  <span className="relative size-5 shrink-0">
                    <Favicon
                      src={new URL("/favicon.ico", site.url).toString()}
                      className="size-5"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-normal">{site.title}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{getHost(site.url)}</span>
                  </span>
                </button>
                <span className="ml-4 flex w-28 shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                  <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover/site:opacity-100 group-focus-within/site:opacity-100" />
                  <span className="flex-1 text-right">{formatLastOpened(site.lastOpenedAt, now)}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-3 text-muted-foreground opacity-0 hover:bg-transparent hover:text-foreground group-hover/site:opacity-100 group-focus-within/site:opacity-100"
                  aria-label={`Delete ${site.title}`}
                  onClick={() => void deleteSite(site)}
                >
                  <X className="size-4" />
                </Button>
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={(event) => void saveSite(event)} className="contents">
            <DialogHeader>
              <DialogTitle>Add bookmark</DialogTitle>
              <DialogDescription>Bookmark a page by its title and web address.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Title"
                aria-label="Title"
                autoFocus
              />
              <Input
                value={draft.url}
                onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                placeholder="https://example.com"
                aria-label="Web address"
                required
              />
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit">Add bookmark</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}