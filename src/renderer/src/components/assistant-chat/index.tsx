import { useEffect, useState } from "react"
import { PanelRightClose, RotateCcw } from "lucide-react"

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

interface AssistantChatProps {
  isOpen: boolean
  onClose: () => void
}

export function AssistantChat({ isOpen, onClose }: AssistantChatProps) {
  const [contextTabIds, setContextTabIds] = useState<string[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [tabs, setTabs] = useState<BrowserTab[]>([])
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
  } = useAssistantChat(activeTabId, contextTabIds)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const contextTabs = contextTabIds
    .map((tabId) => tabs.find((tab) => tab.id === tabId))
    .filter((tab): tab is BrowserTab => tab !== undefined && tab.id !== activeTabId)

  useEffect(() => {
    const updateContextTab = (state: Awaited<ReturnType<typeof window.electron.browser.getTabs>>) => {
      setTabs(state.tabs)
      setActiveTabId(state.activeTabId)
      setContextTabIds((current) => {
        const openTabIds = new Set(state.tabs.map((tab) => tab.id))
        const next = current.filter((tabId) => openTabIds.has(tabId))
        return next.length === current.length && next.every((tabId, index) => tabId === current[index])
          ? current
          : next
      })
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

  function addContextTab(tab: BrowserTab) {
    if (tab.id === activeTabId) return
    setContextTabIds((current) => current.includes(tab.id) ? current : [...current, tab.id])
  }

  function removeContextTab(tabId: string) {
    setContextTabIds((current) => current.filter((id) => id !== tabId))
  }

  return (
    <div
      ref={setDialogContainer}
      className="relative isolate flex min-h-0 flex-1 flex-col bg-muted/30"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm">Talk to June</h1>
        </div>
        <div className="flex items-center gap-0.5">
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
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            onClick={onClose}
            aria-label="Close assistant sidebar"
            title="Close assistant sidebar"
          >
            <PanelRightClose />
          </Button>
        </div>
      </header>

      <ChatMessageList
        messages={messages}
        responseStatus={responseStatus}
        agentActivity={agentActivity}
        tabs={tabs}
        hasModel={Boolean(activeModel)}
        canSendPrompt={Boolean(activeModel) && !isResponding}
        onPrompt={sendMessage}
        onRetry={retryResponse}
      />

      <ChatComposer
        isPanelOpen={isOpen}
        models={aiSettings.models}
        activeModelId={aiSettings.activeModelId}
        tabs={tabs}
        activeTab={activeTab}
        contextTabs={contextTabs}
        isResponding={isResponding}
        onSend={sendMessage}
        onStop={stopResponse}
        onSelectModel={selectModel}
        onAddContextTab={addContextTab}
        onRemoveContextTab={removeContextTab}
      />
    </div>
  )
}
