"use client";

import { useState } from "react";
import { Activity, PenTool } from "lucide-react";

import { GeneralAuditTab } from "./audit/general-audit-tab";
import { SignatureAuditTab } from "./audit/signature-audit-tab";

// Re-export types for any external consumers
export type {
  SignatureAuditLog,
  GeneralAuditLog,
  ChainIntegrity,
  VerificationResult,
} from "./audit/audit-utils";

interface AuditDashboardProps {
  teamId: string;
}

export function AuditDashboard({ teamId }: AuditDashboardProps) {
  const [activeTab, setActiveTab] = useState<"general" | "signature">("general");

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "general"
              ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="mr-2 inline-block h-4 w-4" />
          All Activity
        </button>
        <button
          onClick={() => setActiveTab("signature")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "signature"
              ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <PenTool className="mr-2 inline-block h-4 w-4" />
          Signature Audit
        </button>
      </div>

      {activeTab === "general" ? (
        <GeneralAuditTab teamId={teamId} />
      ) : (
        <SignatureAuditTab teamId={teamId} />
      )}
    </div>
  );
}
