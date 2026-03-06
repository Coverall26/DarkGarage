"use client";

import { useState, useEffect } from "react";
import { HardDrive, TrendingUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Storage Meter — shows org vault storage usage
// ---------------------------------------------------------------------------

interface StorageMeterProps {
  teamId: string;
}

interface Stats {
  totalFilings: number;
  totalSizeBytes: number;
  byDestination: Record<string, number>;
  bySource: Record<string, number>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function StorageMeter({ teamId }: StorageMeterProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/esign/filings?stats=true&pageSize=1`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats ?? null);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [teamId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-4 animate-pulse">
        <div className="h-5 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
    );
  }

  if (!stats) return null;

  const orgVaultCount = stats.byDestination?.ORG_VAULT ?? 0;
  const contactVaultCount = stats.byDestination?.CONTACT_VAULT ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total filed */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            Total Filed
          </span>
        </div>
        <p className="text-2xl font-mono tabular-nums font-semibold text-foreground">
          {stats.totalFilings}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatBytes(stats.totalSizeBytes)} stored
        </p>
      </div>

      {/* Org vault */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Org Vault</span>
        </div>
        <p className="text-2xl font-mono tabular-nums font-semibold text-foreground">
          {orgVaultCount}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">documents</p>
      </div>

      {/* Contact vaults */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-purple-500" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            Contact Vaults
          </span>
        </div>
        <p className="text-2xl font-mono tabular-nums font-semibold text-foreground">
          {contactVaultCount}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">copies filed</p>
      </div>
    </div>
  );
}
