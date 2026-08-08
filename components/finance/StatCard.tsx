export function StatCard({ label, value, icon: Icon, trend }: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`p-2 rounded-lg ${
          trend === "up" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" :
          trend === "down" ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400" :
          "bg-secondary text-muted-foreground"
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
