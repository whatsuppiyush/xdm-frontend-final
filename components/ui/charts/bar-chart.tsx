"use client";

import { Bar } from "recharts";
import { BaseChart, ChartProps } from "./base-chart";

const defaultColors = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

export function BarChart(props: ChartProps) {
  const { categories, colors = defaultColors, stack } = props;

  return (
    <BaseChart {...props} data-oid="0.49n96">
      {categories.map((category, index) => (
        <Bar
          key={category}
          dataKey={category}
          fill={`hsl(var(--${colors[index % colors.length]}))`}
          radius={[4, 4, 0, 0]}
          stackId={stack ? "stack" : undefined}
          maxBarSize={50}
          data-oid="gj.eb2h"
        />
      ))}
    </BaseChart>
  );
}
