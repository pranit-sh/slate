import type { AiUiBlock } from "../../../../../../shared/electron-api"
import {
  AssistantCalloutBlock,
  AssistantCardBlock,
  AssistantChartBlock,
  AssistantLinkListBlock,
  AssistantTableBlock,
} from "./ui-blocks"

interface AssistantUiBlockProps {
  block: AiUiBlock
}

export function AssistantUiBlock({ block }: AssistantUiBlockProps) {
  switch (block.type) {
    case "table":
      return <AssistantTableBlock block={block} />
    case "card":
      return <AssistantCardBlock block={block} />
    case "callout":
      return <AssistantCalloutBlock block={block} />
    case "link-list":
      return <AssistantLinkListBlock block={block} />
    case "chart":
      return <AssistantChartBlock block={block} />
    default:
      return block satisfies never
  }
}