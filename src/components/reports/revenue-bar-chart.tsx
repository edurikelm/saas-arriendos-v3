interface RevenueBarChartProps {
  data: { month: string; revenue: number }[];
}

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="bg-card border border-border rounded p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Histórico de Ingresos
        </h2>
        <p className="text-[10px] text-muted-foreground">Últimos 6 meses</p>
      </div>
      <div className="flex items-end gap-2 px-2 h-40">
        {data.map((item, index) => {
          const heightPct = Math.max((item.revenue / maxRevenue) * 100, 4);
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                ${(item.revenue / 1000).toFixed(0)}k
              </span>
              <div
                className="w-full bg-muted rounded-t transition-all hover:bg-primary"
                style={{ height: `${heightPct}%` }}
                title={`${item.month}: $${item.revenue.toLocaleString("CLP")}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 px-2 text-[9px] text-muted-foreground uppercase tracking-wider tabular-nums">
        {data.map((item, index) => (
          <span key={index}>{item.month}</span>
        ))}
      </div>
    </div>
  );
}
