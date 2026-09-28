import { z } from "zod"

const aiChartSeriesSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  label: z.string().min(1).max(80),
})

export const aiChartBlockSchema = z.object({
  type: z.literal("chart"),
  variant: z.enum(["bar", "line"]),
  title: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  series: z.array(aiChartSeriesSchema).min(1).max(5).refine(
    (series) => new Set(series.map((item) => item.key)).size === series.length,
    "Series keys must be unique.",
  ),
  data: z.array(z.object({
    label: z.string().min(1).max(80),
    values: z.record(z.string(), z.number().finite()),
  })).min(1).max(50),
})

export type AiChartBlock = z.infer<typeof aiChartBlockSchema>