import { z } from "zod"
import { aiUiValueSchema } from "./ui-value"

export const aiCardBlockSchema = z.object({
  type: z.literal("card"),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  details: z.array(z.object({
    label: z.string().min(1).max(80),
    value: aiUiValueSchema,
  })).max(12).optional(),
})

export type AiCardBlock = z.infer<typeof aiCardBlockSchema>