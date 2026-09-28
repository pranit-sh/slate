import type { AiChartBlock } from "../../../../../../../shared/electron-api"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

interface AssistantChartBlockProps {
  block: AiChartBlock
}

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function AssistantChartBlock({ block }: AssistantChartBlockProps) {
  const config = Object.fromEntries(
    block.series.map((series, index) => [
      series.key,
      { label: series.label, color: chartColors[index] },
    ]),
  ) satisfies ChartConfig
  const data = block.data.map((point) => ({ label: point.label, ...point.values }))
  const commonContent = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} width={36} />
      <ChartTooltip content={<ChartTooltipContent />} />
      {block.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
    </>
  )

  return (
    <section className="w-full space-y-2" aria-label={block.title}>
      <div>
        <h2 className="text-sm font-medium">{block.title}</h2>
        {block.description && (
          <p className="text-xs text-muted-foreground">{block.description}</p>
        )}
      </div>
      <ChartContainer config={config} className="h-56 w-full">
        {block.variant === "bar" ? (
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
            {commonContent}
            {block.series.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                fill={`var(--color-${series.key})`}
                radius={3}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
            {commonContent}
            {block.series.map((series) => (
              <Line
                key={series.key}
                dataKey={series.key}
                type="monotone"
                stroke={`var(--color-${series.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        )}
      </ChartContainer>
    </section>
  )
}