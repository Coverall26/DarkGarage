import { Badge } from "@/components/ui/badge";

export function SLAIndicator({
  label,
  onTrack,
  overdue,
  slaLabel,
  avgLabel,
}: {
  label: string;
  onTrack: number;
  overdue: number;
  slaLabel: string;
  avgLabel: string | null;
}) {
  const total = onTrack + overdue;
  const overduePercent = total > 0 ? (overdue / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge
          variant={overdue > 0 ? "destructive" : "secondary"}
          className="font-mono text-xs"
        >
          {overdue > 0 ? `${overdue} overdue` : "On track"}
        </Badge>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {total > 0 && (
          <>
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${100 - overduePercent}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${overduePercent}%` }}
            />
          </>
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>SLA: {slaLabel}</span>
        {avgLabel && <span>Avg: {avgLabel}</span>}
      </div>
    </div>
  );
}
