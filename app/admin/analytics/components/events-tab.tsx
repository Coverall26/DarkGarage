"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Eye } from "lucide-react";
import { ViewEvent, formatRelativeTime } from "./types";

interface EventsTabProps {
  events: ViewEvent[];
}

export function EventsTab({ events }: EventsTabProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2.5 px-4 font-medium">Viewer</th>
                  <th className="text-left py-2.5 px-3 font-medium">Document</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Link</th>
                  <th className="text-right py-2.5 px-3 font-medium hidden lg:table-cell">Duration</th>
                  <th className="text-center py-2.5 px-3 font-medium hidden lg:table-cell">Completion</th>
                  <th className="text-right py-2.5 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4">
                      <p className="text-xs truncate max-w-[160px]">{event.viewerEmail || "Anonymous"}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-xs font-medium truncate max-w-[180px]">{event.documentName}</p>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{event.linkName || "-"}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right hidden lg:table-cell">
                      <span className="font-mono tabular-nums text-xs text-muted-foreground">{event.totalDuration}</span>
                    </td>
                    <td className="py-2.5 px-3 hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(event.completionRate, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {Math.round(event.completionRate)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatRelativeTime(event.viewedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <Eye className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No view events yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
