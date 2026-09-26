import { useState } from "react"
import { Check, Plus } from "lucide-react"
import { Favicon } from "../../../components/favicon"
import { Button } from "../../../components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu"
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover"
import { MAX_PINNED_SITES } from "../../../../../shared/features/pinned-sites"
import { usePinnedSites } from "../hooks/use-pinned-sites"

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function PinnedSitesList() {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const {
    availableTabs,
    bookmark,
    bookmarkedUrls,
    isPinning,
    pin,
    refreshBookmarks,
    sites,
    unpin,
  } = usePinnedSites()
  const isFull = sites.length >= MAX_PINNED_SITES

  return (
    <nav
      aria-label="Pinned sites"
      className="absolute left-1/2 top-8 max-w-[calc(100%-2rem)] -translate-x-1/2 sm:top-12"
    >
      <ul className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border bg-background/90 p-1.5 backdrop-blur-md">
        {sites.map((site) => (
          <li key={site.id} className="shrink-0">
            <ContextMenu onOpenChange={(open) => open && void refreshBookmarks()}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  onClick={() => window.electron.browser.navigate(site.url)}
                  aria-label={`Open ${site.title}`}
                  title={`${site.title} — ${getHost(site.url)}`}
                  className="flex size-11 items-center justify-center rounded-full outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="flex size-8 items-center justify-center rounded-full border bg-card">
                    <Favicon src={site.faviconUrl} className="size-5" />
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => void bookmark(site)}>
                  Bookmark
                  {bookmarkedUrls.has(site.url) && <Check className="ml-auto" />}
                </ContextMenuItem>
                <ContextMenuItem variant="destructive" onSelect={() => void unpin(site.id)}>
                  Remove
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </li>
        ))}
        {!isFull && (
          <li className="shrink-0">
            <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Add pinned site"
                  title="Add pinned site"
                  className="size-11 rounded-full"
                >
                  <Plus />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search open tabs..." />
                  <CommandList>
                    <CommandEmpty>No tabs available to pin.</CommandEmpty>
                    <CommandGroup heading="Open tabs">
                      {availableTabs.map((tab) => (
                        <CommandItem
                          key={tab.id}
                          value={`${tab.title} ${tab.url}`}
                          disabled={isPinning}
                          onSelect={() => {
                            void pin(tab).then((didPin) => {
                              if (didPin) setIsPickerOpen(false)
                            })
                          }}
                        >
                          <Favicon src={tab.faviconUrl} className="size-4" />
                          <span className="min-w-0">
                            <span className="block truncate">{tab.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {getHost(tab.url)}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </li>
        )}
      </ul>
    </nav>
  )
}