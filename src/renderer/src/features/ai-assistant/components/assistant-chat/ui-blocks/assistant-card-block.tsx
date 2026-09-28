import type { AiCardBlock } from "../../../../../../../shared/electron-api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatUiValue } from "./format-ui-value"

interface AssistantCardBlockProps {
  block: AiCardBlock
}

export function AssistantCardBlock({ block }: AssistantCardBlockProps) {
  return (
    <Card size="sm" className="w-full rounded-lg">
      <CardHeader>
        <CardTitle>{block.title}</CardTitle>
        {block.description && <CardDescription>{block.description}</CardDescription>}
      </CardHeader>
      {block.details && block.details.length > 0 && (
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {block.details.map((detail, detailIndex) => (
              <div key={`${detail.label}-${detailIndex}`} className="contents">
                <dt className="text-muted-foreground">{detail.label}</dt>
                <dd className="min-w-0 break-words text-right">
                  {formatUiValue(detail.value)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  )
}