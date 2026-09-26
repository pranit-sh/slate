import { type MouseEvent } from "react"
import { PanelRightOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { useBrowserToolbar } from "../hooks/use-browser-toolbar"
import { AddressTrigger } from "./address-trigger"
import { NavigationControls } from "./navigation-controls"

export function BrowserToolbar() {
  const browser = useBrowserToolbar()
  const { state: sidebarState, toggleSidebar } = useSidebar()

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
          isGhostTab={browser.isGhostTab}
          isLoading={browser.isLoading}
          isOmniboxOpen={browser.isOmniboxOpen}
          closeOmnibox={browser.closeOmnibox}
          createTab={browser.createTab}
          openOmnibox={browser.openOmnibox}
        />
        <div className="no-drag flex items-center justify-end self-stretch">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleSidebar}
            aria-label="Toggle assistant sidebar"
            aria-expanded={sidebarState === "expanded"}
            title="Toggle assistant sidebar"
          >
            <PanelRightOpen />
          </Button>
        </div>
      </header>
    </div>
  )
}