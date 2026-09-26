import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Package,
  type LucideIcon,
} from "lucide-react"
import type { DownloadRecord } from "../../../../../shared/electron-api"

const FILE_ICONS: Array<[Set<string>, LucideIcon]> = [
  [new Set(["avif", "bmp", "gif", "heic", "ico", "jpeg", "jpg", "png", "raw", "svg", "tif", "tiff", "webp"]), FileImage],
  [new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"]), FileVideo],
  [new Set(["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav"]), FileAudio],
  [new Set(["7z", "bz2", "gz", "rar", "tar", "tgz", "xz", "zip"]), FileArchive],
  [new Set(["csv", "numbers", "ods", "xls", "xlsx"]), FileSpreadsheet],
  [new Set(["json", "jsonl"]), FileJson],
  [new Set(["c", "cpp", "cs", "css", "go", "h", "html", "java", "js", "jsx", "php", "py", "rb", "rs", "scss", "sh", "sql", "ts", "tsx", "xml", "yaml", "yml"]), FileCode2],
  [new Set(["doc", "docx", "md", "odt", "pages", "pdf", "rtf", "txt"]), FileText],
  [new Set(["apk", "deb", "dmg", "exe", "msi", "pkg", "rpm"]), Package],
]

export function getFileIcon(filename: string): LucideIcon {
  const extension = filename.split(".").pop()?.toLocaleLowerCase() ?? ""
  return FILE_ICONS.find(([extensions]) => extensions.has(extension))?.[1] ?? File
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

export function getDownloadStatus(download: DownloadRecord): string {
  if (download.state === "progressing") {
    return download.totalBytes > 0
      ? `${formatBytes(download.receivedBytes)} of ${formatBytes(download.totalBytes)}`
      : `${formatBytes(download.receivedBytes)} downloaded`
  }
  if (download.state === "completed") return formatBytes(download.totalBytes || download.receivedBytes)
  if (download.state === "cancelled") return "Cancelled"
  return "Interrupted"
}

export function getSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Unknown source"
  }
}

export function formatDownloadedAt(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)

  if (date.toDateString() === today.toDateString()) return `Today at ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date)
  return `${day} at ${time}`
}

export function getDownloadDay(download: DownloadRecord): string {
  const date = new Date(download.startedAt)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatDownloadDay(day: string): string {
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