import { useEffect, useRef, useState } from "react"
import type { DownloadRecord } from "../../../../../shared/electron-api"
import { getDownloadDay } from "../lib/download-formatters"
import { useDownloadRecords } from "./use-download-records"

export function useDownloads() {
  const downloads = useDownloadRecords() ?? []
  const [expandedDays, setExpandedDays] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const knownDays = useRef(new Set<string>())

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