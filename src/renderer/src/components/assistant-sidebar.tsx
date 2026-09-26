import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react"

import { AssistantChat } from "@/components/assistant-chat"
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar"

const MIN_ASSISTANT_SIDEBAR_WIDTH = 320
const MAX_ASSISTANT_SIDEBAR_WIDTH = 640
const MOBILE_ASSISTANT_SIDEBAR_WIDTH = 288
const SIDEBAR_TRANSITION_DURATION = 200

type AssistantSidebarProps = {
  width: number
  onWidthChange: (width: number) => void
  onResizeStart: () => void
  onResizeEnd: () => void
}

export function AssistantSidebar({
  width,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: AssistantSidebarProps) {
  const { isMobile, open, openMobile } = useSidebar()
  const isVisible = isMobile ? openMobile : open
  const currentInset = useRef(0)
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)

  function getMaximumWidth() {
    return Math.max(
      MIN_ASSISTANT_SIDEBAR_WIDTH,
      Math.min(MAX_ASSISTANT_SIDEBAR_WIDTH, window.innerWidth - 320),
    )
  }

  function updateWidth(nextWidth: number) {
    const constrainedWidth = Math.min(
      getMaximumWidth(),
      Math.max(MIN_ASSISTANT_SIDEBAR_WIDTH, Math.round(nextWidth)),
    )
    onWidthChange(constrainedWidth)
    currentInset.current = constrainedWidth
    window.electron.browser.setContentRightInset(constrainedWidth)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    onResizeStart()
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    updateWidth(drag.current.startWidth + drag.current.startX - event.clientX)
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onResizeEnd()
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    updateWidth(width + (event.key === "ArrowLeft" ? 16 : -16))
  }

  useEffect(() => {
    const targetInset = isVisible
      ? isMobile ? MOBILE_ASSISTANT_SIDEBAR_WIDTH : width
      : 0
    const startingInset = currentInset.current
    const startedAt = performance.now()
    let animationFrame = 0

    const updateInset = (now: number) => {
      const progress = Math.min(
        1,
        (now - startedAt) / SIDEBAR_TRANSITION_DURATION,
      )
      currentInset.current = startingInset + (targetInset - startingInset) * progress
      window.electron.browser.setContentRightInset(currentInset.current)

      if (progress < 1) animationFrame = requestAnimationFrame(updateInset)
    }

    animationFrame = requestAnimationFrame(updateInset)
    return () => cancelAnimationFrame(animationFrame)
  }, [isVisible])

  useEffect(() => {
    return () => window.electron.browser.setContentRightInset(0)
  }, [])

  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      className="top-11 h-[calc(100svh-2.75rem)]"
    >
      <SidebarContent className="overflow-hidden bg-white">
        <AssistantChat />
      </SidebarContent>
      <div
        role="separator"
        aria-label="Resize assistant sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_ASSISTANT_SIDEBAR_WIDTH}
        aria-valuemax={getMaximumWidth()}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onKeyDown={handleResizeKeyDown}
        onDoubleClick={() => updateWidth(getMaximumWidth())}
        className="absolute inset-y-0 left-0 z-30 hidden w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-sidebar-border hover:after:w-0.5 hover:after:bg-ring focus-visible:after:w-0.5 focus-visible:after:bg-ring md:block"
      />
    </Sidebar>
  )
}