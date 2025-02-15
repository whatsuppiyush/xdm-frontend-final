"use client";

import { Line, Bar, Area } from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

const defaultColors = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

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
    <div className={cn("w-full h-full", className)} data-oid="m902l.0">
      <div className="h-full w-full" data-oid="yx556cw">
        <ResponsiveContainer width="100%" height="100%" data-oid="yx.0yum">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            data-oid="43squm-"
          >
            <XAxis
              dataKey={index}
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              data-oid="yvo1pul"
            />

            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
              tick={{ fontSize: 12 }}
              data-oid="eqwo6x7"
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload) return null;
                return (
                  <Card className="p-2 shadow-lg" data-oid="3yz_.sh">
                    {payload.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2"
                        data-oid="yr3-25z"
                      >
                        <div
                          className={`w-2 h-2 rounded-full bg-${colors[index % colors.length]}`}
                          data-oid="23rt0qs"
                        />

                        <span className="font-medium" data-oid="a-el.si">
                          {item.name}:
                        </span>
                        <span data-oid="uhl.l54">
                          {valueFormatter(item.value)}
                        </span>
                      </div>
                    ))}
                  </Card>
                );
              }}
              data-oid="_62d-9f"
            />

            {showLegend && (
              <Legend
                verticalAlign="top"
                height={36}
                content={({ payload }) => (
                  <div className="flex gap-4 justify-end" data-oid="-:5ttkz">
                    {payload?.map((entry: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2"
                        data-oid="7v6o2f3"
                      >
                        <div
                          className={`w-2 h-2 rounded-full bg-${colors[index % colors.length]}`}
                          data-oid="6g4wap9"
                        />

                        <span
                          className="text-sm font-medium"
                          data-oid="_23dqwi"
                        >
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                data-oid="rbzdhlh"
              />
            )}
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              data-oid="4vl4kf3"
            />

            {children}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LineChart(props: ChartProps) {
  return (
    <BaseChart {...props} data-oid="md0hbgb">
      {props.categories.map((category, index) => (
        <Line
          key={category}
          type="monotone"
          dataKey={category}
          stroke={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
          data-oid="sarmyge"
        />
      ))}
    </BaseChart>
  );
}

export function BarChart(props: ChartProps) {
  return (
    <BaseChart {...props} data-oid="x9-uu6k">
      {props.categories.map((category, index) => (
        <Bar
          key={category}
          dataKey={category}
          fill={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          radius={[4, 4, 0, 0]}
          stackId={props.stack ? "stack" : undefined}
          maxBarSize={50}
          data-oid="3l1pkt_"
        />
      ))}
    </BaseChart>
  );
}

export function AreaChart(props: ChartProps) {
  return (
    <BaseChart {...props} data-oid="q2c857-">
      {props.categories.map((category, index) => (
        <Area
          key={category}
          type="monotone"
          dataKey={category}
          fill={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          stroke={`hsl(var(--${props.colors?.[index] || defaultColors[index]}))`}
          fillOpacity={0.2}
          strokeWidth={2}
          data-oid="x2glqja"
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
} from "recharts";
