'use client';

import { ReactNode } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Card } from '@/components/ui/card';

export interface ChartProps {
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

export function BaseChart({
  data,
  index,
  categories,
  colors = defaultColors,
  className,
  valueFormatter = (value: number) => value.toString(),
  showLegend = true,
  children,
}: ChartProps & { children: ReactNode }) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={index}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            stroke="currentColor"
          />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
            tick={{ fontSize: 12 }}
            stroke="currentColor"
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
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}