import { z } from "zod"
import { aiUiValueSchema } from "./ui-value"

export const aiTableBlockSchema = z.object({
  type: z.literal("table"),
  title: z.string().min(1).max(120).optional(),
  columns: z.array(z.object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(80),
  })).min(1).max(10).refine(
    (columns) => new Set(columns.map((column) => column.key)).size === columns.length,
    "Column keys must be unique.",
  ),
  rows: z.array(z.record(z.string(), aiUiValueSchema)).min(1).max(100),
})

export type AiTableBlock = z.infer<typeof aiTableBlockSchema>