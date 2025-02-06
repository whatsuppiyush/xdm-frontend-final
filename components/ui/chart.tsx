'use client';

import { Line, Bar, Area } from 'recharts';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors?: string[];
  className?: string;
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  stack?: boolean;
}

const defaultColors = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

function BaseChart({
  data,
  index,
  categories,
  colors = defaultColors,
  className,
  valueFormatter = (value: number) => value.toString(),
  showLegend = true,
  children,
}: ChartProps & { children: React.ReactNode }) {
  return (
    <div className={cn('w-full h-full', className)}>
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <XAxis
              dataKey={index}
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload) return null;
                return (
                  <Card className="p-2 shadow-lg">
                    {payload.map((item: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${colors[index % colors.length]}`} />
                        <span className="font-medium">{item.name}:</span>
                        <span>{valueFormatter(item.value)}</span>
                      </div>
                    ))}
                  </Card>
                );
              }}
            />
            {showLegend && (
              <Legend
                verticalAlign="top"
                height={36}
                content={({ payload }) => (
                  <div className="flex gap-4 justify-end">
                    {payload?.map((entry: any, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${colors[index % colors.length]}`} />
                        <span className="text-sm font-medium">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
            )}
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            {children}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LineChart(props: ChartProps) {
  return (
    <BaseChart {...props}>
      {props.categories.map((category, index) => (
        <Line
          key={category}
          type="monotone"
          dataKey={category}
          stroke={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      ))}
    </BaseChart>
  );
}

export function BarChart(props: ChartProps) {
  return (
    <BaseChart {...props}>
      {props.categories.map((category, index) => (
        <Bar
          key={category}
          dataKey={category}
          fill={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          radius={[4, 4, 0, 0]}
          stackId={props.stack ? 'stack' : undefined}
          maxBarSize={50}
        />
      ))}
    </BaseChart>
  );
}

export function AreaChart(props: ChartProps) {
  return (
    <BaseChart {...props}>
      {props.categories.map((category, index) => (
        <Area
          key={category}
          type="monotone"
          dataKey={category}
          fill={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          stroke={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      ))}
    </BaseChart>
  );
}

import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ComposedChart,
} from 'recharts';