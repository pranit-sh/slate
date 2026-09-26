import { useEffect, useRef, useState } from "react"
import type { DownloadRecord } from "../../../../../shared/electron-api"
import { getDownloadDay } from "../lib/download-formatters"

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([])
  const [expandedDays, setExpandedDays] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const knownDays = useRef(new Set<string>())

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

  useEffect(() => {
    const newDays = downloads
      .map(getDownloadDay)
      .filter((day) => !knownDays.current.has(day))

    if (newDays.length > 0) {
      setExpandedDays((currentDays) => [...new Set([...currentDays, ...newDays])])
      newDays.forEach((day) => knownDays.current.add(day))
    }
  }, [downloads])

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredDownloads = normalizedQuery
    ? downloads.filter((download) => download.filename.toLocaleLowerCase().includes(normalizedQuery))
    : downloads
  const downloadsByDay = filteredDownloads.reduce<Map<string, DownloadRecord[]>>((groups, download) => {
    const day = getDownloadDay(download)
    const dayDownloads = groups.get(day) ?? []
    dayDownloads.push(download)
    groups.set(day, dayDownloads)
    return groups
  }, new Map())

  return {
    downloads,
    downloadsByDay,
    expandedDays,
    filteredDownloads,
    searchQuery,
    setExpandedDays,
    setSearchQuery,
  }
}