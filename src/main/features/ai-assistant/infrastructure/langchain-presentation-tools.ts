import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { AiUiBlock } from "../../../../shared/electron-api"
import { aiUiBlockSchema } from "../../../../shared/features/ai-assistant"

interface PresentationToolOptions {
  onUiBlock: (block: AiUiBlock) => void
}

export function createPresentationTools({ onUiBlock }: PresentationToolOptions) {
  const presentResults = tool(
    ({ blocks }) => {
      for (const block of blocks) onUiBlock(block)
      return `Displayed ${blocks.length} structured result${blocks.length === 1 ? "" : "s"}.`
    },
    {
      name: "present_results",
      description: "Display structured results in the chat. Use tables for comparisons or repeated fields, cards for individual summaries, link lists for collections of web pages or sources, callouts for important status or warnings, and bar or line charts only for meaningful numeric comparisons or trends. Continue with a concise text response that explains the displayed results.",
      schema: z.object({
        blocks: z.array(aiUiBlockSchema).min(1).max(4),
      }),
    },
  )

  return [presentResults]
}