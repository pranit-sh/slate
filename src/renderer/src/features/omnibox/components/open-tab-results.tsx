import { Ghost, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react"
import type { BrowserTab } from "../../../../../shared/electron-api"
import { CommandGroup, CommandItem } from "@/components/ui/command"
import { Favicon } from "@/components/favicon"
import { groupOpenTabs } from "../lib/group-open-tabs"

interface OpenTabResultsProps {
  tabs: BrowserTab[]
}

export function OpenTabResults({ tabs }: OpenTabResultsProps) {
  if (tabs.length === 0) return null

  return (
    <>
      {groupOpenTabs(tabs).map((group) => (
        <CommandGroup
          key={group.key}
          heading={(
            <span className="flex items-center justify-between gap-3 font-normal">
              <span className="truncate">{group.label}</span>
              <span className="shrink-0 font-normal tabular-nums">
                {group.tabs.length} {group.tabs.length === 1 ? "tab" : "tabs"}
              </span>
            </span>
          )}
        >
          {group.tabs.map((tab) => (
            <CommandItem
              key={tab.id}
              value={tab.id}
              onSelect={() => window.electron.browser.activateTab(tab.id)}
            >
              <span className="relative size-4 shrink-0">
                {tab.isGhost ? (
                  <Ghost className="size-4 text-muted-foreground" />
                ) : (
                  <Favicon src={tab.faviconUrl} className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-normal">{tab.title}</span>
              {(tab.isAudible || tab.isMuted) && (
                <span
                  className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                  aria-label={tab.isMuted ? "Tab is muted" : "Tab is playing audio"}
                  title={tab.isMuted ? "Tab is muted" : "Tab is playing audio"}
                >
                  {tab.isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </span>
              )}
              {tab.isUsingMicrophone && (
                <span
                  className="flex size-7 shrink-0 items-center justify-center text-destructive"
                  aria-label={tab.isMicrophoneMuted
                    ? "Tab microphone is muted"
                    : "Tab is using your microphone"}
                  title={tab.isMicrophoneMuted
                    ? "Tab microphone is muted"
                    : "Tab is using your microphone"}
                >
                  {tab.isMicrophoneMuted
                    ? <MicOff className="size-4" />
                    : <Mic className="size-4" />}
                </span>
              )}
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity group-hover/command-item:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100"
                aria-label={`Close ${tab.title}`}
                title="Close tab"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  window.electron.browser.closeTab(tab.id)
                }}
              >
                <X className="size-4" />
              </button>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </>
  )
}