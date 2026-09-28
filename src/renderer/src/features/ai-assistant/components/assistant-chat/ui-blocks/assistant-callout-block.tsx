import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import type { AiCalloutBlock } from "../../../../../../../shared/electron-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface AssistantCalloutBlockProps {
  block: AiCalloutBlock
}

const toneStyles: Record<AiCalloutBlock["tone"], {
  icon: ComponentType<LucideProps>
  className?: string
}> = {
  info: { icon: Info },
  success: { icon: CircleCheck, className: "border-emerald-600/30 text-emerald-700 dark:text-emerald-400" },
  warning: { icon: TriangleAlert, className: "border-amber-600/30 text-amber-700 dark:text-amber-400" },
  error: { icon: CircleAlert, className: "border-destructive/30 text-destructive" },
}

export function AssistantCalloutBlock({ block }: AssistantCalloutBlockProps) {
  const tone = toneStyles[block.tone]
  const Icon = tone.icon

  return (
    <Alert className={cn("w-full", tone.className)}>
      <Icon aria-hidden="true" />
      <AlertTitle>{block.title}</AlertTitle>
      <AlertDescription className="text-current/80">
        {block.description}
      </AlertDescription>
    </Alert>
  )
}