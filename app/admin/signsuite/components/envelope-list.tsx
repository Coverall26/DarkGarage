"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  MoreHorizontal,
  Send,
  Bell,
  Trash2,
  Eye,
  Ban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "./status-badges";
import type { Envelope } from "./signsuite-types";

interface EnvelopeListProps {
  envelopes: Envelope[];
  loading: boolean;
  onSelect: (envelope: Envelope) => void;
  onSend?: (id: string) => void;
  onRemind?: (id: string) => void;
  onVoid?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function EnvelopeList({
  envelopes,
  loading,
  onSelect,
  onSend,
  onRemind,
  onVoid,
  onDelete,
}: EnvelopeListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border border-border rounded-lg animate-pulse"
          >
            <div className="h-10 w-10 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (envelopes.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No envelopes yet"
        description="Create your first envelope to send documents for signature."
        accentColor="#10B981"
      />
    );
  }

  return (
    <div className="space-y-2">
      {envelopes.map((env) => {
        const signerCount = env.recipients.filter(
          (r) => r.role === "SIGNER",
        ).length;
        const signedCount = env.recipients.filter(
          (r) => r.role === "SIGNER" && r.signedAt,
        ).length;
        const isDraft = env.status === "DRAFT";
        const isActive = ["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(
          env.status,
        );

        return (
          <div
            key={env.id}
            className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
            onClick={() => onSelect(env)}
          >
            {/* Icon */}
            <div className="flex-shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 p-2.5">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {env.title}
                </p>
                <StatusBadge status={env.status} />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>
                  {signerCount > 0 && (
                    <>
                      <span className="font-mono tabular-nums">
                        {signedCount}
                      </span>
                      /{signerCount} signed
                    </>
                  )}
                </span>
                {env.sourceFileName && (
                  <span className="truncate max-w-[200px]">
                    {env.sourceFileName}
                  </span>
                )}
                <span>
                  {formatDistanceToNow(new Date(env.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {/* Recipient pills */}
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {env.recipients.slice(0, 3).map((r, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs px-1.5 py-0"
                  >
                    {r.name || r.email}
                  </Badge>
                ))}
                {env.recipients.length > 3 && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0"
                  >
                    +{env.recipients.length - 3}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="relative flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === env.id ? null : env.id);
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {openMenuId === env.id && (
                <div className="absolute right-0 top-8 z-20 w-40 rounded-md border border-border bg-background shadow-lg py-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(env);
                      setOpenMenuId(null);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </button>
                  {isDraft && onSend && (
                    <button
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-emerald-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSend(env.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Now
                    </button>
                  )}
                  {isActive && onRemind && (
                    <button
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemind(env.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Send Reminder
                    </button>
                  )}
                  {isActive && onVoid && (
                    <button
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVoid(env.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Void
                    </button>
                  )}
                  {isDraft && onDelete && (
                    <button
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(env.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
