"use client";

import {
  CheckCircle2,
  XCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApprovalItem } from "./approval-types";

interface ChangeRequestComparisonProps {
  item: ApprovalItem;
  onApproveChange: () => void;
  onRejectChange: () => void;
  loading: boolean;
}

export function ChangeRequestComparison({
  item,
  onApproveChange,
  onRejectChange,
  loading,
}: ChangeRequestComparisonProps) {
  if (!item.changeRequest) return null;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase">
        Requested Change: {item.changeRequest.fieldName}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-600 font-medium mb-1">Current (Approved)</p>
          <p className="text-sm">{item.changeRequest.currentValue || "—"}</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-xs text-green-600 font-medium mb-1">Requested New</p>
          <p className="text-sm">{item.changeRequest.requestedValue || "—"}</p>
        </div>
      </div>
      {item.changeRequest.reason && (
        <p className="text-xs text-gray-600">
          <strong>Reason:</strong> {item.changeRequest.reason}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onApproveChange}
          disabled={loading}
          className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          Approve Change
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRejectChange}
          disabled={loading}
          className="min-h-[44px] text-red-600 border-red-300 hover:bg-red-50"
        >
          <XCircleIcon className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}
