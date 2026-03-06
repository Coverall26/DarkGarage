"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { VisitorRow, ENGAGEMENT_CONFIG, formatRelativeTime } from "./types";

interface VisitorsTabProps {
  visitors: VisitorRow[];
}

export function VisitorsTab({ visitors }: VisitorsTabProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        {visitors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2.5 px-4 font-medium">Visitor</th>
                  <th className="text-left py-2.5 px-3 font-medium">Engagement</th>
                  <th className="text-center py-2.5 px-3 font-medium">Views</th>
                  <th className="text-center py-2.5 px-3 font-medium hidden md:table-cell">Documents</th>
                  <th className="text-right py-2.5 px-3 font-medium hidden lg:table-cell">Time Spent</th>
                  <th className="text-right py-2.5 px-3 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visitors.map((visitor) => {
                  const config = ENGAGEMENT_CONFIG[visitor.engagementTier];
                  const TierIcon = config.icon;
                  return (
                    <tr key={visitor.email} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <p className="text-sm font-medium">{visitor.viewerName || visitor.email}</p>
                        {visitor.viewerName && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {visitor.email}
                          </p>
                        )}
                        {visitor.verified && (
                          <Badge variant="outline" className="text-xs px-1 py-0 mt-0.5 text-emerald-600 border-emerald-200">
                            Verified
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {visitor.engagementTier !== "NONE" ? (
                          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${config.className}`}>
                            <TierIcon className="h-3 w-3 mr-0.5" />
                            {config.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-mono tabular-nums">{visitor.totalViews}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center hidden md:table-cell">
                        <span className="font-mono tabular-nums">{visitor.uniqueDocuments}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right hidden lg:table-cell">
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {visitor.totalDuration}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-xs text-muted-foreground font-mono">
                          {visitor.lastActive ? formatRelativeTime(visitor.lastActive) : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No visitors yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Share your dataroom link to start tracking engagement.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
