"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface DataPoint {
  label: string;
  entrate: number;
  uscite: number;
  profitto: number;
}

interface Props {
  data: DataPoint[];
  granularity: "day" | "month";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 space-y-1.5 text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-medium" style={{ color: entry.color }}>
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function FinancialChart({ data, granularity }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Nessun dato disponibile per il periodo selezionato
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => `€${v}`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" />

        {/* Entrate – bar verde */}
        <Bar
          dataKey="entrate"
          name="Entrate"
          fill="hsl(142 71% 45%)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          fillOpacity={0.85}
        />

        {/* Uscite – bar rossa */}
        <Bar
          dataKey="uscite"
          name="Uscite"
          fill="hsl(0 84% 60%)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          fillOpacity={0.85}
        />

        {/* Profitto netto – linea */}
        <Line
          type="monotone"
          dataKey="profitto"
          name="Profitto netto"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={{ fill: "hsl(var(--primary))", r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
