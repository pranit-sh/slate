import { z } from "zod"

export const aiCalloutBlockSchema = z.object({
  type: z.literal("callout"),
  tone: z.enum(["info", "success", "warning", "error"]),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
})

export type AiCalloutBlock = z.infer<typeof aiCalloutBlockSchema>