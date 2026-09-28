import { z } from "zod"

export const aiUiValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

export type AiUiValue = z.infer<typeof aiUiValueSchema>