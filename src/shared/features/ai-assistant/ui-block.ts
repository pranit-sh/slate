import { z } from "zod"
import { aiCalloutBlockSchema } from "./callout-block"
import { aiCardBlockSchema } from "./card-block"
import { aiChartBlockSchema } from "./chart-block"
import { aiLinkListBlockSchema } from "./link-list-block"
import { aiTableBlockSchema } from "./table-block"

export const aiUiBlockSchema = z.discriminatedUnion("type", [
  aiTableBlockSchema,
  aiCardBlockSchema,
  aiCalloutBlockSchema,
  aiLinkListBlockSchema,
  aiChartBlockSchema,
])

export type AiUiBlock = z.infer<typeof aiUiBlockSchema>