import { type CSSProperties, useEffect, useState } from "react"

import { Home } from "@/components/home"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AssistantSidebar } from "@/features/ai-assistant"
import { BrowserToolbar } from "@/features/browser-toolbar"

export default function App() {
  const [assistantWidth, setAssistantWidth] = useState(640)
  const [devToolsWidth, setDevToolsWidth] = useState(0)
  const [isResizingAssistant, setIsResizingAssistant] = useState(false)

  useEffect(() => {
    return window.electron.browser.onDevToolsWidthChanged(setDevToolsWidth)
  }, [])

  return (
    <SidebarProvider
      defaultOpen={false}
      data-resizing={isResizingAssistant}
      className="h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={{
        "--sidebar-width": `${assistantWidth}px`,
        "--sidebar-right-offset": `${devToolsWidth}px`,
      } as CSSProperties}
    >
      <BrowserToolbar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Home />
        </main>
        <AssistantSidebar
          width={assistantWidth}
          onWidthChange={setAssistantWidth}
          onResizeStart={() => setIsResizingAssistant(true)}
          onResizeEnd={() => setIsResizingAssistant(false)}
        />
        <div aria-hidden className="shrink-0" style={{ width: devToolsWidth }} />
      </div>
    </SidebarProvider>
  )
}