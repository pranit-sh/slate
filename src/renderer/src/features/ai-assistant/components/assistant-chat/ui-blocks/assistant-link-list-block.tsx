import { ExternalLink } from "lucide-react"
import type { AiLinkListBlock } from "../../../../../../../shared/electron-api"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

interface AssistantLinkListBlockProps {
  block: AiLinkListBlock
}

function getHostname(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "")
}

export function AssistantLinkListBlock({ block }: AssistantLinkListBlockProps) {
  return (
    <section className="w-full space-y-2" aria-label={block.title ?? "Links"}>
      {block.title && <h2 className="text-sm font-medium">{block.title}</h2>}
      <ItemGroup className="gap-1">
        {block.items.map((item) => (
          <Item key={item.url} asChild size="sm" variant="outline">
            <button
              type="button"
              className="flex-nowrap text-left"
              onClick={() => window.electron.browser.openUrl(item.url)}
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="max-w-full truncate">{item.title}</ItemTitle>
                <ItemDescription>
                  {item.description ?? getHostname(item.url)}
                </ItemDescription>
              </ItemContent>
              <ItemMedia variant="icon" className="text-muted-foreground">
                <ExternalLink aria-hidden="true" />
              </ItemMedia>
            </button>
          </Item>
        ))}
      </ItemGroup>
    </section>
  )
}