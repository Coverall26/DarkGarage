"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { FileText } from "lucide-react";
import { DocumentRow, ViewEvent, formatRelativeTime } from "./types";
import { DocumentDetailPanel } from "./document-detail-panel";

interface DocumentsTabProps {
  documents: DocumentRow[];
  events: ViewEvent[];
  selectedDocId: string | null;
  onSelectDoc: (docId: string | null) => void;
}

export function DocumentsTab({
  documents,
  events,
  selectedDocId,
  onSelectDoc,
}: DocumentsTabProps) {
  const docViewers = selectedDocId
    ? events.filter((e) => e.documentName === documents.find((d) => d.id === selectedDocId)?.name)
    : [];

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {documents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2.5 px-4 font-medium">Document</th>
                    <th className="text-center py-2.5 px-3 font-medium">Views</th>
                    <th className="text-center py-2.5 px-3 font-medium hidden sm:table-cell">Downloads</th>
                    <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell">Time Spent</th>
                    <th className="text-center py-2.5 px-3 font-medium hidden lg:table-cell">Completion</th>
                    <th className="text-right py-2.5 px-3 font-medium">Last Viewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedDocId === doc.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      onClick={() => onSelectDoc(selectedDocId === doc.id ? null : doc.id)}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                          <p className="text-sm font-medium truncate max-w-[280px]">{doc.name}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-mono tabular-nums">{doc.views}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                        <span className="font-mono tabular-nums">{doc.downloads}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right hidden md:table-cell">
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">{doc.totalDuration}</span>
                      </td>
                      <td className="py-2.5 px-3 hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(doc.completionRate, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-xs text-muted-foreground">
                            {Math.round(doc.completionRate)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-xs text-muted-foreground font-mono">
                          {doc.lastViewed ? formatRelativeTime(doc.lastViewed) : "-"}
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
                <FileText className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No document views yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDocId && (
        <DocumentDetailPanel
          document={documents.find((d) => d.id === selectedDocId) || null}
          viewers={docViewers}
          onClose={() => onSelectDoc(null)}
        />
      )}
    </>
  );
}
