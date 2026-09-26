import { useEffect, useState, type RefObject } from "react"
import { BorderBeam } from "border-beam"
import { ChartNoAxesGantt, Ghost, Mic, MicOff, Plus, Volume2, VolumeX } from "lucide-react"
import type { BrowserTab } from "../../../../../shared/electron-api"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Favicon } from "@/components/favicon"
import { Spinner } from "@/components/ui/spinner"
import { ADDRESS_PLACEHOLDERS } from "../content"

interface AddressTriggerProps {
  activeTab: BrowserTab | null
  address: string
  addressButtonRef: RefObject<HTMLButtonElement | null>
  isGhostTab: boolean
  isLoading: boolean
  isOmniboxOpen: boolean
  closeOmnibox(): void
  createTab(): void
  openOmnibox(): void
}

export function AddressTrigger({
  activeTab,
  address,
  addressButtonRef,
  isGhostTab,
  isLoading,
  isOmniboxOpen,
  closeOmnibox,
  createTab,
  openOmnibox,
}: AddressTriggerProps) {
  const [isSiteSettingsOpen, setIsSiteSettingsOpen] = useState(false)
  const [addressPlaceholder] = useState(() =>
    ADDRESS_PLACEHOLDERS[Math.floor(Math.random() * ADDRESS_PLACEHOLDERS.length)])
  const isWebPage = /^https?:\/\//i.test(address)
  const placeholder = isGhostTab ? "Search in Ghost Tab" : addressPlaceholder

  useEffect(() =>
    window.electron.browser.onSiteSettingsVisibilityChanged(setIsSiteSettingsOpen), [])

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
    <div className="no-drag relative flex min-w-0 items-center gap-1">
      <BorderBeam active={false} className="min-w-0 flex-1" size="pulse-inner" theme="auto">
        <ButtonGroup className="w-full min-w-0 rounded-lg border bg-accent/55">
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
            aria-label={placeholder}
            aria-haspopup="listbox"
            aria-expanded={isOmniboxOpen}
            title={address || placeholder}
          >
            <span className={`truncate ${address ? "" : "text-muted-foreground"}`}>
              {address || placeholder}
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
      <Button
        size="icon"
        variant="ghost"
        onClick={createTab}
        aria-label="New tab"
        title="New tab"
      >
        <Plus />
      </Button>
    </div>
  )
}