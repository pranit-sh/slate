import { useState } from "react"
import {
  BookOpen,
  Brain,
  CircleX,
  ExternalLink,
  FolderCog,
  MessageCircle,
  Navigation,
  PenLine,
  RefreshCw,
  Search,
  Cable,
  ShieldQuestion,
  TextSearch,
  Workflow,
} from "lucide-react"
import { ThinkingOrb, type OrbState } from "thinking-orbs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { AiAgentActivity, BrowserTab } from "../../../../../../shared/electron-api"
import { AssistantMessageContent } from "./assistant-message-content"
import { QUICK_PROMPTS } from "./content"
import type { ChatMessage, ResponseStatus } from "./types"

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
})

function formatDuration(durationMs: number) {
  return `${(durationMs / 1_000).toFixed(1)}s`
}

function ActivityIcon({ state }: { state: AiAgentActivity["state"] }) {
  const icons = {
    understanding: Brain,
    searching: Search,
    opening: ExternalLink,
    navigating: Navigation,
    reading: BookOpen,
    finding: TextSearch,
    organizing: FolderCog,
    waiting: ShieldQuestion,
    composing: PenLine,
  }
  const Icon = icons[state]
  return <Icon />
}

const activityOrbStates: Record<AiAgentActivity["state"], OrbState> = {
  understanding: "solving",
  searching: "searching",
  opening: "connecting",
  navigating: "connecting",
  reading: "working",
  finding: "searching",
  organizing: "shaping",
  waiting: "breathing",
  composing: "composing",
}

function ActivityStatus({ status }: { status: AiAgentActivity["status"] }) {
  if (status === "active" || status === "complete") return null
  const label = status === "cancelled" ? "Cancelled" : "Failed"

  return (
    <span
      className="inline-flex size-3 shrink-0 self-center items-center justify-center text-destructive"
      title={label}
    >
      <CircleX className="size-3" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function ActivityTimeline({ activities }: { activities: AiAgentActivity[] }) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="activity"
      className="w-full max-w-sm"
    >
      <AccordionItem value="activity" className="border-0">
        <AccordionTrigger className="justify-start gap-1.5 py-1 text-xs font-normal text-muted-foreground hover:no-underline [&>svg]:size-3">
          <Workflow className="size-3" />
          {activities.length} action{activities.length === 1 ? "" : "s"}
        </AccordionTrigger>
        <AccordionContent className="pb-1 pl-1 pt-1">
          <div className="relative space-y-1.5">
            {activities.length > 1 && (
              <span
                aria-hidden="true"
                className="absolute bottom-2 left-[5.5px] top-2 w-px bg-border"
              />
            )}
            {activities.map((activity, index) => (
              <Marker key={activity.id ?? `${activity.state}-${activity.label}-${index}`}>
                <MarkerIcon className="relative z-10 size-3 bg-background">
                  <ActivityIcon state={activity.state} />
                </MarkerIcon>
                <MarkerContent
                  className={`flex min-w-0 items-baseline gap-1 text-xs ${
                    activity.status === "active" ? "shimmer" : ""
                  }`}
                >
                  <span className="text-foreground">{activity.label}</span>
                  {activity.detail && (
                    <span className="truncate text-muted-foreground" title={activity.detail}>
                      {activity.detail}
                    </span>
                  )}
                  <ActivityStatus status={activity.status} />
                </MarkerContent>
              </Marker>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

interface ChatMessageListProps {
  messages: ChatMessage[]
  responseStatus: ResponseStatus
  agentActivity: AiAgentActivity | null
  tabs: BrowserTab[]
  hasModel: boolean
  canSendPrompt: boolean
  onPrompt: (content: string) => void
  onRetry: (messageId: string) => void
}

function pickQuickPrompts() {
  const prompts = [...QUICK_PROMPTS]

  for (let index = prompts.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[prompts[index], prompts[randomIndex]] = [prompts[randomIndex], prompts[index]]
  }

  return prompts.slice(0, 3)
}

function EmptyChat({
  hasModel,
  canSendPrompt,
  onPrompt,
}: Pick<ChatMessageListProps, "hasModel" | "canSendPrompt" | "onPrompt">) {
  const [quickPrompts] = useState(pickQuickPrompts)

  return (
    <Empty className="rounded-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {hasModel ? <MessageCircle /> : <Cable />}
        </EmptyMedia>
        <EmptyTitle>{hasModel ? "Start a conversation" : "Connect an AI model"}</EmptyTitle>
        {!hasModel && (
          <EmptyDescription>
            Add a provider in Settings to get help with your pages and tabs.
          </EmptyDescription>
        )}
      </EmptyHeader>
      {hasModel && (
        <EmptyContent className="max-w-md flex-row flex-wrap justify-center gap-2">
          {quickPrompts.map((label) => (
            <Button
              key={label}
              type="button"
              variant="outline"
              className="h-auto w-fit justify-center whitespace-nowrap px-2.5 py-1.5 text-xs font-normal"
              disabled={!canSendPrompt}
              onClick={() => onPrompt(label)}
            >
              {label}
            </Button>
          ))}
        </EmptyContent>
      )}
    </Empty>
  )
}

/** Scrollable transcript with the typing indicator and error surface. */
export function ChatMessageList({
  messages,
  responseStatus,
  agentActivity,
  tabs,
  hasModel,
  canSendPrompt,
  onPrompt,
  onRetry,
}: ChatMessageListProps) {
  const isResponding = responseStatus !== "ready"

  if (messages.length === 0) {
    return <EmptyChat hasModel={hasModel} canSendPrompt={canSendPrompt} onPrompt={onPrompt} />
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent aria-busy={isResponding} className="gap-3 px-5 py-6">
            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.role === "user"}
              >
                <Message align={message.role === "user" ? "end" : "start"}>
                  <MessageContent
                    className={message.role === "user" ? "items-end gap-1" : "items-start gap-1"}
                  >
                    {message.activities && message.activities.length > 0 && (
                      <ActivityTimeline activities={message.activities} />
                    )}
                    {message.content && (
                      <Bubble
                        align={message.role === "user" ? "end" : "start"}
                        variant={message.role === "user" ? "outline" : "ghost"}
                        className={
                          message.role === "user"
                            ? "max-w-[92%] *:data-[slot=bubble-content]:border-foreground/20"
                            : "max-w-full"
                        }
                      >
                        <BubbleContent className="rounded-lg">
                          {message.role === "assistant" ? (
                            <AssistantMessageContent content={message.content} tabs={tabs} />
                          ) : (
                            message.content
                          )}
                        </BubbleContent>
                      </Bubble>
                    )}
                    {message.error && (
                      <div className="flex max-w-full items-center gap-1">
                        <Bubble variant="destructive" className="min-w-0 max-w-full">
                          <BubbleContent className="rounded-lg" role="alert">
                            {message.error}
                          </BubbleContent>
                        </Bubble>
                        {hasModel && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="font-normal text-muted-foreground"
                            onClick={() => onRetry(message.id)}
                          >
                            <RefreshCw />
                            Retry
                          </Button>
                        )}
                      </div>
                    )}
                    {message.interrupted && (
                      <Marker>
                        <MarkerContent>Response stopped</MarkerContent>
                      </Marker>
                    )}
                    {message.content && (
                      <MessageFooter
                        className={`min-h-4 text-[10px] font-normal opacity-0 transition-opacity group-hover/message:opacity-100 ${message.role === "assistant" ? "w-full" : ""}`}
                      >
                        {message.role === "user" ? (
                          timeFormatter.format(message.createdAt)
                        ) : (
                          <>
                            <span>{message.modelName ?? "Assistant"}</span>
                            <span className="ml-auto">
                              {message.responseDurationMs === undefined
                                ? "Responding"
                                : `Replied in ${formatDuration(message.responseDurationMs)}`}
                            </span>
                          </>
                        )}
                      </MessageFooter>
                    )}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}

            {responseStatus === "submitted" && agentActivity && (
              <MessageScrollerItem>
                <Message>
                  <MessageContent>
                    <Marker role="status">
                      <MarkerIcon className="size-5">
                        <ThinkingOrb state={activityOrbStates[agentActivity.state]} size={20} />
                      </MarkerIcon>
                      <MarkerContent className="flex min-w-0 items-baseline gap-1 shimmer">
                        <span>{agentActivity.label}</span>
                        {agentActivity.detail && (
                          <span
                            className="truncate text-muted-foreground"
                            title={agentActivity.detail}
                          >
                            {agentActivity.detail}
                          </span>
                        )}
                      </MarkerContent>
                    </Marker>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="bottom-3" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
