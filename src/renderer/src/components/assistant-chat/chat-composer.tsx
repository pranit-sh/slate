import { type KeyboardEvent, useRef, useState } from "react"
import { BorderBeam } from "border-beam"
import { ArrowUpIcon, ChevronDown, Square } from "lucide-react"

import { Favicon } from "@/components/favicon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import type { AiModel, BrowserTab } from "../../../../shared/electron-api"
import { CHAT_PLACEHOLDERS } from "./content"

const PROVIDER_FAVICON_URLS: Record<AiModel["provider"], string> = {
  openai: "https://openai.com/favicon.ico",
  anthropic: "https://www.anthropic.com/favicon.ico",
  gemini: "https://www.google.com/favicon.ico",
}


function pickPlaceholder() {
  const placeholders = [...CHAT_PLACEHOLDERS]

  for (let index = placeholders.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[placeholders[index], placeholders[randomIndex]] = [
      placeholders[randomIndex],
      placeholders[index],
    ]
  }

  return placeholders[0]
}

function ModelOption({ model }: { model: AiModel }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Favicon src={PROVIDER_FAVICON_URLS[model.provider]} className="size-3.5 shrink-0" />
      <span className="truncate">{model.name}</span>
    </span>
  )
}

interface ChatComposerProps {
  models: AiModel[]
  activeModelId: string | null
  contextTab: BrowserTab | null
  isResponding: boolean
  onSend: (content: string) => void
  onStop: () => void
  onSelectModel: (modelId: string) => void
}

/**
 * GitHub Copilot–style composer: an auto-sizing textarea with an inline
 * footer that hosts the model selector on the left and the send/stop
 * control on the right.
 */
export function ChatComposer({
  models,
  activeModelId,
  contextTab,
  isResponding,
  onSend,
  onStop,
  onSelectModel,
}: ChatComposerProps) {
  const [draft, setDraft] = useState("")
  const [placeholder] = useState(pickPlaceholder)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasModel = models.length > 0
  const activeModel = models.find((model) => model.id === activeModelId)
  const canSend = Boolean(draft.trim()) && !isResponding && hasModel

  function submit() {
    if (!canSend) return
    onSend(draft)
    setDraft("")
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="w-full shrink-0 bg-transparent px-3 pb-3 pt-2">
      <BorderBeam active={isResponding} className="w-full" theme="auto">
        <InputGroup className="h-auto flex-col items-stretch rounded-lg border-foreground/20 bg-background shadow-none">
        {contextTab && (
          <InputGroupAddon
            align="block-start"
            className="min-w-0 justify-start gap-1.5 overflow-x-auto border-b px-2 py-1.5 [.border-b]:pb-1.5"
          >
            <span
              className="flex h-6 min-w-0 max-w-56 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-1.5 text-[11px] font-normal text-foreground"
              aria-label={`Page context: ${contextTab.title || contextTab.url}`}
            >
              <Favicon src={contextTab.faviconUrl} className="size-3.5 shrink-0" />
              <span className="truncate">{contextTab.title || contextTab.url}</span>
            </span>
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          rows={1}
          className="max-h-40 min-h-9 resize-none px-3 py-3 text-sm text-foreground"
        />
          <InputGroupAddon align="block-end" className="gap-1.5 px-3 pb-2.5 pt-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!hasModel}
                  aria-label={hasModel ? "Select AI model" : "No AI models configured"}
                  className="min-w-0 max-w-36 gap-1 px-1.5 text-[11px] font-normal text-foreground [&>svg]:size-3"
                >
                  {activeModel ? <ModelOption model={activeModel} /> : hasModel ? "Select model" : "No models"}
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuRadioGroup
                  value={activeModelId ?? ""}
                  onValueChange={onSelectModel}
                >
                  {models.map((model) => (
                    <DropdownMenuRadioItem
                      key={model.id}
                      value={model.id}
                      className="text-xs"
                    >
                      <ModelOption model={model} />
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {isResponding ? (
              <InputGroupButton
                type="button"
                variant="default"
                size="icon-xs"
                onClick={onStop}
                aria-label="Stop response"
                className="ml-auto rounded-full"
              >
                <Square className="size-2.5 fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="button"
                variant="default"
                size="icon-xs"
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
                className="ml-auto rounded-full"
              >
                <ArrowUpIcon className="size-3.5" />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </BorderBeam>
    </div>
  )
}
