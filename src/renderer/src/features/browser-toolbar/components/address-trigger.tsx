import { useEffect, useRef, useState, type RefObject } from "react"
import { BorderBeam } from "border-beam"
import { Bookmark, ChartNoAxesGantt, Ghost, Mic, MicOff, PanelsTopLeft, Pin, Volume2, VolumeX } from "lucide-react"
import type { AddressBarFeedback, BrowserTab } from "../../../../../shared/electron-api"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Favicon } from "@/components/favicon"
import { Spinner } from "@/components/ui/spinner"
import { ADDRESS_PLACEHOLDERS } from "../content"

interface AddressTriggerProps {
  activeTab: BrowserTab | null
  address: string
  addressButtonRef: RefObject<HTMLButtonElement | null>
  addressBarFeedback: AddressBarFeedback | null
  isGhostTab: boolean
  isLoading: boolean
  isOmniboxOpen: boolean
  closeOmnibox(): void
  openOmnibox(): void
}

export function AddressTrigger({
  activeTab,
  address,
  addressButtonRef,
  addressBarFeedback,
  isGhostTab,
  isLoading,
  isOmniboxOpen,
  closeOmnibox,
  openOmnibox,
}: AddressTriggerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSiteSettingsOpen, setIsSiteSettingsOpen] = useState(false)
  const [addressPlaceholder] = useState(() =>
    ADDRESS_PLACEHOLDERS[Math.floor(Math.random() * ADDRESS_PLACEHOLDERS.length)])
  const isWebPage = /^https?:\/\//i.test(address)
  const placeholder = isGhostTab ? "Search in Ghost Tab" : addressPlaceholder
  const feedbackLabel = addressBarFeedback === "bookmark-saved"
    ? "Bookmark saved"
    : addressBarFeedback === "bookmark-removed"
      ? "Bookmark removed"
      : addressBarFeedback === "site-pinned"
        ? "Pinned to home"
        : addressBarFeedback === "site-unpinned"
          ? "Removed from home"
          : addressBarFeedback === "tab-opened-background"
            ? "Opened in background tab"
            : null
  const canDisplayFeedback = isWebPage || addressBarFeedback === "tab-opened-background"
  const displayedFeedback = isOmniboxOpen || !canDisplayFeedback ? null : feedbackLabel

  useEffect(() =>
    window.electron.browser.onSiteSettingsVisibilityChanged(setIsSiteSettingsOpen), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reportBounds = () => {
      const { x, y, width, height } = container.getBoundingClientRect()
      window.electron.browser.setAddressBarBounds({ x, y, width, height })
    }
    const resizeObserver = new ResizeObserver(reportBounds)
    resizeObserver.observe(container)
    window.addEventListener("resize", reportBounds)
    reportBounds()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", reportBounds)
    }
  }, [])

  function handleOpenOmnibox(): void {
    setIsSiteSettingsOpen(false)
    window.electron.browser.setSiteSettingsVisible(false)
    openOmnibox()
  }

  function toggleSiteSettings(): void {
    const visible = !isSiteSettingsOpen
    setIsSiteSettingsOpen(visible)
    if (visible) closeOmnibox()
    window.electron.browser.setSiteSettingsVisible(visible)
  }

  return (
    <div ref={containerRef} className="no-drag relative flex min-w-0 items-center">
      <BorderBeam active={false} className="min-w-0 flex-1" size="pulse-inner" theme="auto">
        <ButtonGroup
          className={`w-full min-w-0 rounded-lg border bg-accent/55 transition-[border-color,box-shadow] duration-150 ${displayedFeedback ? "border-foreground ring-1 ring-foreground" : ""}`}
        >
          {(isGhostTab || isWebPage) && (
            <span
              className="relative flex size-8 shrink-0 items-center justify-center"
              aria-label={isGhostTab ? "Ghost tab" : undefined}
              title={isGhostTab ? "Ghost tab" : undefined}
            >
              {isGhostTab ? (
                <Ghost className="size-4" />
              ) : isLoading ? (
                <Spinner />
              ) : (
                <Favicon
                  src={activeTab?.faviconUrl ?? ""}
                  className="size-4"
                  fallbackClassName="text-foreground"
                />
              )}
            </span>
          )}
          <Button
            ref={addressButtonRef}
            type="button"
            variant="ghost"
            onClick={handleOpenOmnibox}
            className="h-8 min-w-0 flex-1 bg-transparent px-3 font-normal shadow-none"
            aria-label={displayedFeedback ?? placeholder}
            aria-haspopup="listbox"
            aria-expanded={isOmniboxOpen}
            title={displayedFeedback ?? (address || placeholder)}
          >
            <span
              className={`flex min-w-0 items-center gap-1.5 ${displayedFeedback || address ? "" : "text-muted-foreground"}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {displayedFeedback && (
                addressBarFeedback?.startsWith("bookmark-") ? (
                  <Bookmark
                    className={`size-4 shrink-0 ${addressBarFeedback === "bookmark-saved" ? "fill-current" : ""}`}
                  />
                ) : addressBarFeedback?.startsWith("site-") ? (
                  <Pin
                    className={`size-4 shrink-0 ${addressBarFeedback === "site-pinned" ? "fill-current" : ""}`}
                  />
                ) : (
                  <PanelsTopLeft className="size-4 shrink-0" />
                )
              )}
              <span className="truncate">{displayedFeedback ?? (address || placeholder)}</span>
            </span>
          </Button>
          {(activeTab?.isAudible || activeTab?.isMuted) && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="bg-transparent text-muted-foreground shadow-none"
              aria-label={activeTab.isMuted ? "Unmute tab" : "Mute tab"}
              title={activeTab.isMuted ? "Unmute tab" : "Mute tab"}
              onClick={() => window.electron.browser.setTabMuted(activeTab.id, !activeTab.isMuted)}
            >
              {activeTab.isMuted ? <VolumeX /> : <Volume2 />}
            </Button>
          )}
          {activeTab?.isUsingMicrophone && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="bg-transparent text-destructive shadow-none hover:text-destructive"
              aria-label={activeTab.isMicrophoneMuted ? "Unmute microphone" : "Mute microphone"}
              title={activeTab.isMicrophoneMuted ? "Unmute microphone" : "Mute microphone"}
              onClick={() => window.electron.browser.setTabMicrophoneMuted(
                activeTab.id,
                !activeTab.isMicrophoneMuted,
              )}
            >
              {activeTab.isMicrophoneMuted ? <MicOff /> : <Mic />}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            hidden={!isWebPage || isGhostTab}
            aria-label="Site settings"
            aria-expanded={isSiteSettingsOpen}
            title="Site settings"
            className="bg-transparent shadow-none"
            onClick={toggleSiteSettings}
          >
            <ChartNoAxesGantt />
          </Button>
        </ButtonGroup>
      </BorderBeam>
    </div>
  )
}