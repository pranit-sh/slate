import { CommandGroup, CommandItem } from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import type { BrowserCommand } from "../types"

interface CommandResultsProps {
  commands: BrowserCommand[]
}

export function CommandResults({ commands }: CommandResultsProps) {
  if (commands.length === 0) return null

  return (
    <CommandGroup heading="Commands">
      {commands.map((command) => {
        const Icon = command.icon
        return (
          <CommandItem key={command.id} value={command.label} onSelect={command.execute}>
            <Icon />
            <span>{command.label}</span>
            <KbdGroup className="ml-auto">
              {command.shortcut.map((key, index) => <Kbd key={`${key}-${index}`}>{key}</Kbd>)}
            </KbdGroup>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}