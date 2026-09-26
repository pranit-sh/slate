import { useEffect, useRef, useState } from "react"
import { Bookmark, Pin } from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
import type { BrowserTab, PinnedSite, SavedSite } from "../../shared/electron-api"
import { MAX_PINNED_SITES } from "../../shared/features/pinned-sites"

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString()
  } catch {
    return url
  }
}

export default function SiteSettingsApp() {
  const [tab, setTab] = useState<BrowserTab | null>(null)
  const [bookmark, setBookmark] = useState<SavedSite | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [pinnedSite, setPinnedSite] = useState<PinnedSite | null>(null)
  const [pinnedSiteCount, setPinnedSiteCount] = useState(0)
  const [isPinned, setIsPinned] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const refresh = (): void => {
      void Promise.all([
        window.electron.browser.getTabs(),
        window.electron.browser.getSavedSites(),
        window.electron.browser.getPinnedSites(),
      ]).then(([tabsState, sites, pinnedSites]) => {
        const activeTab = tabsState.tabs.find((item) => item.id === tabsState.activeTabId) ?? null
        setTab(activeTab)
        const savedSite = activeTab
          ? sites.find((site) => site.url === normalizeUrl(activeTab.url)) ?? null
          : null
        setBookmark(savedSite)
        setIsBookmarked(Boolean(savedSite))
        const currentPinnedSite = activeTab
          ? pinnedSites.find((site) => site.url === normalizeUrl(activeTab.url)) ?? null
          : null
        setPinnedSite(currentPinnedSite)
        setPinnedSiteCount(pinnedSites.length)
        setIsPinned(Boolean(currentPinnedSite))
      })
    }

    refresh()
    return window.electron.browser.onSiteSettingsOpened(refresh)
  }, [])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const reportSize = () => {
      const bounds = content.getBoundingClientRect()
      window.electron.browser.setSiteSettingsSize(bounds.width, bounds.height)
    }
    const observer = new ResizeObserver(reportSize)
    observer.observe(content)
    reportSize()
    return () => observer.disconnect()
  }, [])

  async function handleBookmarkToggle(pressed: boolean): Promise<void> {
    if (!tab || isUpdating) return

    const previousState = isBookmarked
    setIsBookmarked(pressed)
    setIsUpdating(true)
    try {
      if (pressed) {
        setBookmark(await window.electron.browser.createSavedSite({
          title: tab.title,
          url: tab.url,
        }))
      } else if (bookmark) {
        await window.electron.browser.deleteSavedSite(bookmark.id)
        setBookmark(null)
      }
    } catch (error) {
      setIsBookmarked(previousState)
      throw error
    } finally {
      setIsUpdating(false)
    }
  }

  async function handlePinToggle(pressed: boolean): Promise<void> {
    if (!tab || isUpdating) return

    const previousState = isPinned
    setIsPinned(pressed)
    setIsUpdating(true)
    try {
      if (pressed) {
        const site = await window.electron.browser.createPinnedSite({
          title: tab.title,
          url: tab.url,
          faviconUrl: tab.faviconUrl,
        })
        setPinnedSite(site)
        setPinnedSiteCount((count) => Math.min(MAX_PINNED_SITES, count + 1))
      } else if (pinnedSite) {
        await window.electron.browser.deletePinnedSite(pinnedSite.id)
        setPinnedSite(null)
        setPinnedSiteCount((count) => Math.max(0, count - 1))
      }
    } catch (error) {
      setIsPinned(previousState)
      throw error
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <main ref={contentRef} className="flex w-44 flex-col gap-1 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md">
      <Toggle
        pressed={isBookmarked}
        disabled={!tab || isUpdating}
        onPressedChange={(pressed) => void handleBookmarkToggle(pressed)}
        size="sm"
        variant="default"
        aria-label="Toggle bookmark"
        className="justify-start"
      >
        <Bookmark className="group-data-[state=on]/toggle:fill-foreground" />
        Bookmark
      </Toggle>
      <Toggle
        pressed={isPinned}
        disabled={!tab || isUpdating || (!isPinned && pinnedSiteCount >= MAX_PINNED_SITES)}
        onPressedChange={(pressed) => void handlePinToggle(pressed)}
        size="sm"
        variant="default"
        aria-label="Toggle pin to home"
        title={!isPinned && pinnedSiteCount >= MAX_PINNED_SITES ? "Home is full (5 sites)" : undefined}
        className="justify-start"
      >
        <Pin className="group-data-[state=on]/toggle:fill-foreground" />
        Pin to home
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {pinnedSiteCount}/{MAX_PINNED_SITES}
        </span>
      </Toggle>
    </main>
  )
}