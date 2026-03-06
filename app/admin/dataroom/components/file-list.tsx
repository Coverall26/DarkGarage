"use client";

import { FileText, Download, Shield, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { FiledDocument } from "./dataroom-types";
import { SOURCE_TYPE_LABELS, DEST_TYPE_LABELS } from "./dataroom-types";

// ---------------------------------------------------------------------------
// File List — shows filed documents with download & audit info
// ---------------------------------------------------------------------------

interface FileListProps {
  filings: FiledDocument[];
  loading: boolean;
  selectedPath: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileList({ filings, loading, selectedPath }: FileListProps) {
  // Filter by selected folder path
  const filtered = selectedPath
    ? filings.filter(
        (f) => f.orgVaultPath && f.orgVaultPath.startsWith(selectedPath),
      )
    : filings;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 bg-muted rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Documents auto-file here when envelopes are completed in SignSuite."
        accentColor="#2563EB"
      />
    );
  }

  return (
    <div className="space-y-1">
      {filtered.map((filing) => (
        <div
          key={filing.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          {/* Icon */}
          <div className="flex-shrink-0 rounded-md bg-blue-600/10 p-2">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {filing.filedFileName ?? "Untitled"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {SOURCE_TYPE_LABELS[filing.sourceType] || filing.sourceType}
              </Badge>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {DEST_TYPE_LABELS[filing.destinationType] ||
                  filing.destinationType}
              </Badge>
              {filing.envelope && (
                <span className="text-xs text-muted-foreground truncate">
                  {filing.envelope.title}
                </span>
              )}
            </div>
          </div>

          {/* Size */}
          <span className="text-xs font-mono tabular-nums text-muted-foreground flex-shrink-0">
            {filing.filedFileSize ? formatBytes(filing.filedFileSize) : "—"}
          </span>

          {/* Audit hash indicator */}
          {filing.auditHash && (
            <Shield
              className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0"
              aria-label="SHA-256 verified"
            />
          )}

          {/* Time */}
          <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDistanceToNow(new Date(filing.createdAt), {
              addSuffix: true,
            })}
          </span>

          {/* Download */}
          {filing.filedFileUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 flex-shrink-0"
              asChild
            >
              <a
                href={filing.filedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download ${filing.filedFileName ?? "document"}`}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
