import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ChatComposer } from "./chat-composer"
import { ChatMessageList } from "./chat-message-list"
import { useAssistantChat } from "./use-assistant-chat"
import type { BrowserTab } from "../../../../shared/electron-api"

export function AssistantChat() {
  const [contextTab, setContextTab] = useState<BrowserTab | null>(null)
  const [dialogContainer, setDialogContainer] = useState<HTMLDivElement | null>(null)
  const {
    messages,
    responseStatus,
    agentActivity,
    isResponding,
    aiSettings,
    activeModel,
    sendMessage,
    selectModel,
    stopResponse,
    retryResponse,
    resetConversation,
  } = useAssistantChat()

  useEffect(() => {
    const updateContextTab = (state: Awaited<ReturnType<typeof window.electron.browser.getTabs>>) => {
      setContextTab(state.tabs.find((tab) => tab.id === state.activeTabId) ?? null)
    }
    const removeTabsListener = window.electron.browser.onTabsChanged(updateContextTab)
    let isSubscribed = true

    void window.electron.browser.getTabs().then((state) => {
      if (isSubscribed) updateContextTab(state)
    })

    return () => {
      isSubscribed = false
      removeTabsListener()
    }
  }, [])

  return (
    <div
      ref={setDialogContainer}
      className="relative isolate flex min-h-0 flex-1 flex-col bg-muted/30"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm">Talk to June</h1>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label="Reset conversation"
            >
              <RotateCcw />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent
            portalContainer={dialogContainer}
            overlayClassName="absolute"
            className="absolute"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently clear the current conversation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={resetConversation}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <ChatMessageList
        messages={messages}
        responseStatus={responseStatus}
        agentActivity={agentActivity}
        canSendPrompt={Boolean(activeModel) && !isResponding}
        onPrompt={sendMessage}
        onRetry={retryResponse}
      />

      <ChatComposer
        models={aiSettings.models}
        activeModelId={aiSettings.activeModelId}
        contextTab={contextTab}
        isResponding={isResponding}
        onSend={sendMessage}
        onStop={stopResponse}
        onSelectModel={selectModel}
      />
    </div>
  )
}
