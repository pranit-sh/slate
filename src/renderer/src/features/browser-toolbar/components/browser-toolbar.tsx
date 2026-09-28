import { type MouseEvent } from "react"
import { Ghost, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { DownloadActivity } from "@/features/downloads"
import { useBrowserToolbar } from "../hooks/use-browser-toolbar"
import { AddressTrigger } from "./address-trigger"
import { NavigationControls } from "./navigation-controls"

export function BrowserToolbar() {
  const browser = useBrowserToolbar()
  const commandKey = window.electron.platform === "darwin" ? "⌘" : "Ctrl+"
  const shiftKey = window.electron.platform === "darwin" ? "⇧" : "Shift+"

  function handleToolbarMouseDown(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement
    if (!target.closest("button")) browser.blurAddress()
  }

  function handleToolbarDoubleClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement
    if (!target.closest("button")) window.electron.window.toggleMaximize()
  }

  return (
    <div className="relative z-10 shrink-0 bg-background">
      <header
        className="drag-region grid h-11 grid-cols-[minmax(180px,1fr)_minmax(240px,640px)_minmax(180px,1fr)] items-center gap-3 border-b px-3"
        onMouseDown={handleToolbarMouseDown}
        onDoubleClick={handleToolbarDoubleClick}
      >
        <NavigationControls
          canGoBack={browser.canGoBack}
          canGoForward={browser.canGoForward}
          isLoading={browser.isLoading}
        />
        <AddressTrigger
          activeTab={browser.activeTab}
          address={browser.address}
          addressButtonRef={browser.addressButtonRef}
          addressBarFeedback={browser.addressBarFeedback}
          isGhostTab={browser.isGhostTab}
          isLoading={browser.isLoading}
          isOmniboxOpen={browser.isOmniboxOpen}
          closeOmnibox={browser.closeOmnibox}
          openOmnibox={browser.openOmnibox}
        />
        <div className="no-drag flex items-center justify-between gap-1 self-stretch">
          <ButtonGroup className="rounded-lg">
            <Button
              size="icon"
              variant="ghost"
              className="bg-transparent shadow-none"
              onClick={browser.createTab}
              aria-label="New tab"
              title={`New tab (${commandKey}T)`}
            >
              <Plus />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="bg-transparent shadow-none"
              onClick={browser.createGhostTab}
              aria-label="New Ghost Tab"
              title={`New Ghost Tab (${commandKey}${shiftKey}T)`}
            >
              <Ghost />
            </Button>
          </ButtonGroup>
          <DownloadActivity />
        </div>
      </header>
    </div>
  )
}