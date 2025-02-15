"use client";

import { Line } from "recharts";
import { BaseChart, ChartProps } from "./base-chart";

const defaultColors = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

export function LineChart(props: ChartProps) {
  const { categories, colors = defaultColors } = props;

  return (
    <BaseChart {...props} data-oid="4ge58v2">
      {categories.map((category, index) => (
        <Line
          key={category}
          type="monotone"
          dataKey={category}
          stroke={`hsl(var(--${colors[index % colors.length]}))`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
          data-oid="x0dk2.r"
        />
      ))}
    </BaseChart>
  );
}
