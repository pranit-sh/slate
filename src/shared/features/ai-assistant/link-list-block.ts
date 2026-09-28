import { z } from "zod"

export const aiLinkListBlockSchema = z.object({
  type: z.literal("link-list"),
  title: z.string().min(1).max(120).optional(),
  items: z.array(z.object({
    title: z.string().min(1).max(120),
    url: z.url({ protocol: /^https?$/ }).max(2048),
    description: z.string().min(1).max(300).optional(),
  })).min(1).max(12),
})

export type AiLinkListBlock = z.infer<typeof aiLinkListBlockSchema>