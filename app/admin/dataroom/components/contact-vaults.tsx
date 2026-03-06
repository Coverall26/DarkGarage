"use client";

import { useState, useEffect } from "react";
import {
  User,
  Clock,
  FileText,
  HardDrive,
  ExternalLink,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContactVaultRecord } from "./dataroom-types";

// ---------------------------------------------------------------------------
// Contact Vaults — per-signer document vaults with magic link access
// ---------------------------------------------------------------------------

interface ContactVaultsProps {
  teamId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ContactVaults({ teamId }: ContactVaultsProps) {
  const [vaults, setVaults] = useState<ContactVaultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchVaults() {
      try {
        const res = await fetch(`/api/dataroom/vaults?teamId=${teamId}`);
        if (res.ok) {
          const data = await res.json();
          setVaults(data.vaults ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchVaults();
  }, [teamId]);

  const filtered = search.trim()
    ? vaults.filter((v) => {
        const q = search.toLowerCase();
        return (
          v.contact.email.toLowerCase().includes(q) ||
          (v.contact.firstName ?? "").toLowerCase().includes(q) ||
          (v.contact.lastName ?? "").toLowerCase().includes(q) ||
          (v.contact.company ?? "").toLowerCase().includes(q)
        );
      })
    : vaults;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vaults..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <User className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            {vaults.length === 0 ? "No contact vaults yet" : "No results"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Vaults are auto-created when documents are signed in SignSuite
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((vault) => {
            const name =
              [vault.contact.firstName, vault.contact.lastName]
                .filter(Boolean)
                .join(" ") || vault.contact.email;
            const isExpired =
              vault.expiresAt && new Date(vault.expiresAt) < new Date();

            return (
              <div
                key={vault.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {/* Avatar */}
                <div className="flex-shrink-0 rounded-full bg-muted p-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {vault.contact.email}
                    </span>
                    {vault.contact.company && (
                      <span className="text-xs text-muted-foreground">
                        · {vault.contact.company}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" aria-hidden="true" />
                      <span className="font-mono tabular-nums">
                        {vault.totalDocuments}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <HardDrive className="h-3 w-3" aria-hidden="true" />
                      <span className="font-mono tabular-nums">
                        {formatBytes(vault.totalSizeBytes)}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  {isExpired ? (
                    <Badge
                      variant="destructive"
                      className="text-xs px-1.5"
                    >
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1.5">
                      Active
                    </Badge>
                  )}

                  {/* Created */}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatDistanceToNow(new Date(vault.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
