'use client';

import { Area } from 'recharts';
import { BaseChart, ChartProps } from './base-chart';

const defaultColors = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

export function AreaChart(props: ChartProps) {
  const { categories, colors = defaultColors } = props;
  
  return (
    <BaseChart {...props}>
      {categories.map((category, index) => (
        <Area
          key={category}
          type="monotone"
          dataKey={category}
          fill={`hsl(var(--${colors[index % colors.length]}))`}
          stroke={`hsl(var(--${colors[index % colors.length]}))`}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      ))}
    </BaseChart>
  );
}