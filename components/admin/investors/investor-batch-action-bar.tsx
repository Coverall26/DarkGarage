"use client";

import { Button } from "@/components/ui/button";
import {
  UserCheck,
  Download,
  Mail,
  X,
  Loader2,
} from "lucide-react";

interface InvestorBatchActionBarProps {
  selectedCount: number;
  batchLoading: boolean;
  onApprove: () => void;
  onEmail: () => void;
  onExport: () => void;
  onClear: () => void;
}

export function InvestorBatchActionBar({
  selectedCount,
  batchLoading,
  onApprove,
  onEmail,
  onExport,
  onClear,
}: InvestorBatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-[#0A1628] text-white rounded-xl shadow-2xl px-5 py-3 border border-gray-700">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>
        <div className="w-px h-5 bg-gray-600" />
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 gap-1.5"
          onClick={onApprove}
          disabled={batchLoading}
        >
          {batchLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserCheck className="h-4 w-4" aria-hidden="true" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 gap-1.5"
          onClick={onEmail}
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Email
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 gap-1.5"
          onClick={onExport}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </Button>
        <div className="w-px h-5 bg-gray-600" />
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-white/10 min-h-[32px] min-w-[32px] flex items-center justify-center"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
