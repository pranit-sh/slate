import { useEffect, useRef, useState } from "react"
import { CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDownloadRecords } from "../hooks/use-download-records"

const COMPLETION_VISIBLE_MS = 5_000

interface CompletedActivity {
  count: number
  filename: string
}

export function DownloadActivity() {
  const downloads = useDownloadRecords()
  const previousStates = useRef(new Map<string, string>())
  const completionTimeout = useRef<number | null>(null)
  const [completedActivity, setCompletedActivity] = useState<CompletedActivity | null>(null)

  useEffect(() => {
    if (!downloads) return

    if (previousStates.current.size === 0) {
      previousStates.current = new Map(downloads.map((download) => [download.id, download.state]))
      return
    }

    const completed = downloads.filter((download) =>
      download.state === "completed"
      && previousStates.current.get(download.id) === "progressing"
    )
    previousStates.current = new Map(downloads.map((download) => [download.id, download.state]))
    if (completed.length === 0) return

    setCompletedActivity({ count: completed.length, filename: completed[0].filename })
    if (completionTimeout.current !== null) window.clearTimeout(completionTimeout.current)
    completionTimeout.current = window.setTimeout(() => setCompletedActivity(null), COMPLETION_VISIBLE_MS)
  }, [downloads])

  useEffect(() => () => {
    if (completionTimeout.current !== null) window.clearTimeout(completionTimeout.current)
  }, [])

  const activeDownloads = downloads?.filter((download) => download.state === "progressing") ?? []
  const activeCount = activeDownloads.length
  if (activeCount === 0 && !completedActivity) return null

  if (activeCount === 0 && completedActivity) {
    const label = completedActivity.count === 1
      ? `${completedActivity.filename} downloaded`
      : `${completedActivity.count} downloads complete`

    return (
      <Button
        size="sm"
        variant="ghost"
        className="max-w-48 font-normal text-muted-foreground"
        onClick={window.electron.browser.openDownloads}
        aria-label={`${label}. Open downloads`}
        title={label}
      >
        <CircleCheck className="text-emerald-600" />
        <span className="truncate" role="status">{label}</span>
      </Button>
    )
  }

  const hasKnownProgress = activeDownloads.every((download) => download.totalBytes > 0)
  const totalBytes = activeDownloads.reduce((total, download) => total + download.totalBytes, 0)
  const receivedBytes = activeDownloads.reduce(
    (total, download) => total + Math.min(download.receivedBytes, download.totalBytes),
    0,
  )
  const progress = hasKnownProgress && totalBytes > 0
    ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
    : null
  const countLabel = activeCount === 1 ? "1 download" : `${activeCount} downloads`
  const label = progress === null ? `${countLabel} in progress` : `${countLabel}, ${progress}% complete`

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="font-normal text-muted-foreground"
      onClick={window.electron.browser.openDownloads}
      aria-label={`${label}. Open downloads`}
      title={label}
    >
      <span className="relative grid size-5 shrink-0 place-items-center rounded-full">
        {progress === null ? (
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        ) : (
          <span
            className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(var(--foreground) ${progress}%, var(--muted) 0)`,
          }}
          />
        )}
        <span className="absolute inset-0.5 rounded-full bg-background" />
        <span className="relative text-[9px] font-normal tabular-nums text-foreground" aria-hidden="true">
          {activeCount}
        </span>
      </span>
    </Button>
  )
}