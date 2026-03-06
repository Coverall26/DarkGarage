"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, X } from "lucide-react";
import { DocumentRow, ViewEvent, formatRelativeTime } from "./types";

interface DocumentDetailPanelProps {
  document: DocumentRow | null;
  viewers: ViewEvent[];
  onClose: () => void;
}

export function DocumentDetailPanel({ document, viewers, onClose }: DocumentDetailPanelProps) {
  if (!document) return null;

  const uniqueViewers = new Map<string, { email: string; views: number; totalTime: string; lastSeen: string }>();
  for (const v of viewers) {
    const existing = uniqueViewers.get(v.viewerEmail);
    if (existing) {
      existing.views += 1;
      if (new Date(v.viewedAt) > new Date(existing.lastSeen)) {
        existing.lastSeen = v.viewedAt;
      }
    } else {
      uniqueViewers.set(v.viewerEmail, {
        email: v.viewerEmail,
        views: 1,
        totalTime: v.totalDuration,
        lastSeen: v.viewedAt,
      });
    }
  }

  const viewerList = Array.from(uniqueViewers.values()).sort((a, b) => b.views - a.views);

  return (
    <Card className="shadow-sm border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold text-lg">{document.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Document Analytics Detail</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close document details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Views</p>
            <p className="text-xl font-bold font-mono tabular-nums">{document.views}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Downloads</p>
            <p className="text-xl font-bold font-mono tabular-nums">{document.downloads}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Avg. Completion</p>
            <p className="text-xl font-bold font-mono tabular-nums">{Math.round(document.completionRate)}%</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Time Spent</p>
            <p className="text-xl font-bold font-mono tabular-nums">{document.totalDuration}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Completion Rate</span>
            <span className="text-xs font-mono tabular-nums">{Math.round(document.completionRate)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(document.completionRate, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3">Viewers ({viewerList.length})</h4>
          {viewerList.length > 0 ? (
            <div className="space-y-2">
              {viewerList.map((viewer) => (
                <div
                  key={viewer.email}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{viewer.email || "Anonymous"}</p>
                      <p className="text-xs text-muted-foreground">
                        {viewer.views} view{viewer.views !== 1 ? "s" : ""} · Last seen {formatRelativeTime(viewer.lastSeen)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums ml-2 flex-shrink-0">
                    {viewer.totalTime}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No viewer data available for this document.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
