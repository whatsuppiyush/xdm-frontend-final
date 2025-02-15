"use client";

import { ReactNode } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";

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

const defaultColors = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

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
    <div className="h-full w-full" data-oid="yy:anp2">
      <ResponsiveContainer width="100%" height="100%" data-oid="01nztrn">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          data-oid="xidkm.u"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-muted"
            data-oid="ue68gc-"
          />

          <XAxis
            dataKey={index}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            data-oid=".6-nssz"
          />

          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            data-oid="dx9ri0t"
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload) return null;
              return (
                <Card className="p-2 shadow-lg" data-oid="qyqe-rn">
                  {payload.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2"
                      data-oid="2:lko2d"
                    >
                      <div
                        className={`w-2 h-2 rounded-full bg-${colors[index % colors.length]}`}
                        data-oid="23.-hh9"
                      />

                      <span className="font-medium" data-oid=":u8152u">
                        {item.name}:
                      </span>
                      <span data-oid="-0kvi9a">
                        {valueFormatter(item.value)}
                      </span>
                    </div>
                  ))}
                </Card>
              );
            }}
            data-oid="u5uut80"
          />

          {showLegend && (
            <Legend
              verticalAlign="top"
              height={36}
              content={({ payload }) => (
                <div className="flex gap-4 justify-end" data-oid="hou_:bp">
                  {payload?.map((entry: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2"
                      data-oid="o2d2ulr"
                    >
                      <div
                        className={`w-2 h-2 rounded-full bg-${colors[index % colors.length]}`}
                        data-oid="6zek3mg"
                      />

                      <span className="text-sm font-medium" data-oid="l2u7.2n">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              data-oid="5b6c:o8"
            />
          )}
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
