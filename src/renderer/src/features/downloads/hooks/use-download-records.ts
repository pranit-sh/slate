import { useEffect, useState } from "react"
import type { DownloadRecord } from "../../../../../shared/electron-api"

export function useDownloadRecords() {
  const [downloads, setDownloads] = useState<DownloadRecord[] | null>(null)

  useEffect(() => {
    let isCurrent = true
    const refreshDownloads = () => {
      void window.electron.browser.getDownloads().then((items) => {
        if (isCurrent) setDownloads(items)
      })
    }
    const removeListener = window.electron.browser.onDownloadsChanged(setDownloads)
    const interval = window.setInterval(refreshDownloads, 2_000)
    refreshDownloads()
    return () => {
      isCurrent = false
      window.clearInterval(interval)
      removeListener()
    }
  }, [])

  return downloads
}