import { useEffect, useState } from "react"
import type { RecentlyClosedPage } from "../../../../../shared/electron-api"

export function useRecentlyClosed() {
  const [pages, setPages] = useState<RecentlyClosedPage[]>([])

  useEffect(() => {
    let isSubscribed = true
    const removeListener = window.electron.browser.onRecentlyClosedChanged(setPages)

    void window.electron.browser.getRecentlyClosed().then((items) => {
      if (isSubscribed) setPages(items)
    }).catch((error) => console.error("Failed to load recently closed pages", error))

    return () => {
      isSubscribed = false
      removeListener()
    }
  }, [])

  function reopen(page: RecentlyClosedPage): void {
    window.electron.browser.reopenRecentlyClosed(page.id)
  }

  return { pages, reopen }
}