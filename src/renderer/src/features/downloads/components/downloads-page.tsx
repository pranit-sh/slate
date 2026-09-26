import { Fragment } from "react"
import {
  Copy,
  Download,
  FolderOpen,
  FolderX,
  Search,
  SearchX,
  Square,
} from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { useDownloads } from "../hooks/use-downloads"
import {
  formatDownloadDay,
  formatDownloadedAt,
  getDownloadStatus,
  getFileIcon,
  getSourceDomain,
} from "../lib/download-formatters"

export function DownloadsPage() {
  const {
    downloads,
    downloadsByDay,
    expandedDays,
    filteredDownloads,
    searchQuery,
    setExpandedDays,
    setSearchQuery,
  } = useDownloads()

  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-8 py-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <InputGroup className="max-w-sm">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search downloads"
              aria-label="Search downloads"
            />
          </InputGroup>
          {downloads.some((download) => download.state !== "progressing") && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="ghost">Clear</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear download history?</AlertDialogTitle>
                  <AlertDialogDescription>Downloaded files will remain on your computer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void window.electron.browser.clearDownloads()}>
                    Clear history
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {downloads.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Download /></EmptyMedia>
              <EmptyTitle className="font-normal">No downloads</EmptyTitle>
              <EmptyDescription>Files you download will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filteredDownloads.length === 0 ? (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
              <EmptyTitle className="font-normal">No matching downloads</EmptyTitle>
              <EmptyDescription>Try a different file name.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Accordion
            type="multiple"
            value={expandedDays}
            onValueChange={setExpandedDays}
            className="overflow-hidden rounded-lg border"
          >
            {[...downloadsByDay].map(([day, dayDownloads]) => (
              <AccordionItem key={day} value={day}>
                <AccordionTrigger className="rounded-none bg-muted px-4 font-normal hover:no-underline">
                  <span>{formatDownloadDay(day)}</span>
                  <span className="ml-auto font-normal text-muted-foreground">
                    {dayDownloads.length} {dayDownloads.length === 1 ? "file" : "files"}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <Separator />
                  <div>
                    {dayDownloads.map((download, index) => {
              const progress = download.totalBytes > 0
                ? Math.min(100, (download.receivedBytes / download.totalBytes) * 100)
                : 0
              const isMissing = download.state === "completed" && !download.fileExists
              const isCancelled = download.state === "cancelled"
              const showCopyAction = download.state !== "progressing"
              const showLocationAction = showCopyAction && !isCancelled
              const FileIcon = getFileIcon(download.filename)
              return (
                <Fragment key={download.id}>
                  {index > 0 && <Separator />}
                  <div className="group/download flex min-h-16 items-center gap-3 px-3 py-2">
                    <FileIcon className="size-5 shrink-0 text-muted-foreground" />
                    <button
                      type="button"
                      disabled={download.state !== "completed" || isMissing}
                      className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
                      onClick={() => void window.electron.browser.openDownload(download.id)}
                    >
                      <span className={`block truncate text-sm font-normal ${isCancelled ? "text-muted-foreground line-through" : ""}`}>
                        {download.filename}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {getSourceDomain(download.url)}
                        <span aria-hidden="true"> · </span>
                        <span className={isMissing ? "text-destructive" : undefined}>
                          {isMissing ? "File deleted" : getDownloadStatus(download)}
                        </span>
                      </span>
                      {download.state === "progressing" && (
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full bg-foreground transition-[width]" style={{ width: `${progress}%` }} />
                        </span>
                      )}
                    </button>
                    {(download.state === "completed" || isCancelled) && (
                      <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                        {formatDownloadedAt(download.completedAt ?? download.updatedAt)}
                      </span>
                    )}
                    {showCopyAction && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground opacity-0 group-hover/download:opacity-100 group-focus-within/download:opacity-100"
                        aria-label={`Copy download link for ${download.filename}`}
                        title="Copy download link"
                        onClick={() => void window.electron.browser.copyDownloadLink(download.id)}
                      >
                        <Copy />
                      </Button>
                    )}
                    {download.state === "progressing" ? (
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`Cancel ${download.filename}`}
                        title="Cancel download"
                        onClick={() => void window.electron.browser.cancelDownload(download.id)}
                      >
                        <Square className="size-3.5" />
                      </Button>
                    ) : null}
                    {isCancelled && <span aria-hidden="true" className="size-7 shrink-0" />}
                    {showLocationAction && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={isMissing ? "text-destructive" : "text-muted-foreground"}
                        aria-label={`Show ${download.filename} in Finder`}
                        title="Show in Finder"
                        onClick={() => void window.electron.browser.showDownloadInFolder(download.id)}
                      >
                        {isMissing ? <FolderX /> : <FolderOpen />}
                      </Button>
                    )}
                  </div>
                </Fragment>
              )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </main>
  )
}