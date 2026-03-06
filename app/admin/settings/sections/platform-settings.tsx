"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Shield,
  ToggleLeft,
  ToggleRight,
  Calendar,
  AlertTriangle,
  Loader2,
  Construction,
  Lock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformSettingsData {
  paywallEnforced: boolean;
  paywallBypassUntil: string | null;
  registrationOpen: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  envPaywallBypass: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlatformSettingsSection() {
  const [data, setData] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local form state
  const [paywallEnforced, setPaywallEnforced] = useState(false);
  const [bypassUntil, setBypassUntil] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/platform/settings");
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Platform owner access required");
          return;
        }
        throw new Error("Failed to load platform settings");
      }
      const result = await res.json();
      setData(result);
      setPaywallEnforced(result.paywallEnforced ?? false);
      setBypassUntil(
        result.paywallBypassUntil
          ? new Date(result.paywallBypassUntil).toISOString().split("T")[0]
          : "",
      );
      setRegistrationOpen(result.registrationOpen ?? true);
      setMaintenanceMode(result.maintenanceMode ?? false);
      setMaintenanceMessage(result.maintenanceMessage ?? "");
      setDirty(false);
    } catch (error) {
      toast.error("Failed to load platform settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paywallEnforced,
          paywallBypassUntil: bypassUntil
            ? new Date(bypassUntil).toISOString()
            : null,
          registrationOpen,
          maintenanceMode,
          maintenanceMessage: maintenanceMessage || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
        return;
      }
      toast.success("Platform settings updated");
      setDirty(false);
      fetchSettings();
    } catch (error) {
      toast.error("Failed to save platform settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-2">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Platform owner access required to view these settings.
        </p>
      </div>
    );
  }

  const markChanged = () => {
    if (!dirty) setDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Env bypass indicator */}
      {data.envPaywallBypass && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            <strong>PAYWALL_BYPASS</strong> env var is set to &quot;true&quot; — all paywall checks are bypassed regardless of these settings.
          </span>
        </div>
      )}

      {/* Paywall Enforcement */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Paywall Enforcement</h4>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Enforce Paywall</p>
              <p className="text-xs text-muted-foreground">
                When enabled, organizations must have an active FundRoom subscription to access paid features.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setPaywallEnforced(!paywallEnforced);
              markChanged();
            }}
            className="flex-shrink-0"
            aria-label={paywallEnforced ? "Disable paywall" : "Enable paywall"}
          >
            {paywallEnforced ? (
              <ToggleRight className="h-8 w-8 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium">Time-Limited Bypass</p>
            <p className="text-xs text-muted-foreground mb-2">
              Bypass all paywall checks until this date. Leave blank for no bypass.
            </p>
            <Input
              type="date"
              value={bypassUntil}
              onChange={(e) => {
                setBypassUntil(e.target.value);
                markChanged();
              }}
              className="w-48 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Registration</h4>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Open Registration</p>
              <p className="text-xs text-muted-foreground">
                Allow new organizations to sign up. Disabling prevents new GP signups.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setRegistrationOpen(!registrationOpen);
              markChanged();
            }}
            className="flex-shrink-0"
            aria-label={registrationOpen ? "Close registration" : "Open registration"}
          >
            {registrationOpen ? (
              <ToggleRight className="h-8 w-8 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Maintenance Mode</h4>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Construction className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">
                Display a maintenance page to all non-admin users.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMaintenanceMode(!maintenanceMode);
              markChanged();
            }}
            className="flex-shrink-0"
            aria-label={maintenanceMode ? "Disable maintenance mode" : "Enable maintenance mode"}
          >
            {maintenanceMode ? (
              <ToggleRight className="h-8 w-8 text-amber-600" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
        </div>

        {maintenanceMode && (
          <div className="pl-8">
            <label className="text-xs text-muted-foreground mb-1 block">
              Maintenance Message
            </label>
            <Input
              value={maintenanceMessage}
              onChange={(e) => {
                setMaintenanceMessage(e.target.value);
                markChanged();
              }}
              placeholder="We're performing scheduled maintenance. Please check back soon."
              className="text-sm"
            />
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-[#0066FF] text-white hover:bg-[#0052CC]"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Platform Settings
        </Button>
      </div>
    </div>
  );
}
