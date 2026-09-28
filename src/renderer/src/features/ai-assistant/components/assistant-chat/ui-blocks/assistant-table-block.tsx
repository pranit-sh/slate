import type { AiTableBlock } from "../../../../../../../shared/electron-api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatUiValue } from "./format-ui-value"

interface AssistantTableBlockProps {
  block: AiTableBlock
}

export function AssistantTableBlock({ block }: AssistantTableBlockProps) {
  return (
    <section className="w-full space-y-2" aria-label={block.title ?? "Results table"}>
      {block.title && <h2 className="text-sm font-medium">{block.title}</h2>}
      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {block.columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {block.columns.map((column) => (
                  <TableCell key={column.key}>
                    {formatUiValue(row[column.key] ?? null)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}