"use client";

import { useState, useEffect } from "react";
import { Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ApprovalItem } from "./approval-types";

interface RequestChangesModalProps {
  item: ApprovalItem;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    requestedChanges: Array<{
      changeType: string;
      fieldName: string;
      reason: string;
      currentValue?: string;
    }>,
    notes: string,
  ) => void;
  submitting: boolean;
}

export function RequestChangesModal({
  item,
  open,
  onClose,
  onSubmit,
  submitting,
}: RequestChangesModalProps) {
  const [flaggedFields, setFlaggedFields] = useState<Record<string, boolean>>({});
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState("");

  useEffect(() => {
    if (open) {
      setFlaggedFields({});
      setFieldNotes({});
      setGeneralNotes("");
    }
  }, [open]);

  const flaggedCount = Object.values(flaggedFields).filter(Boolean).length;

  const handleSubmit = () => {
    const requestedChanges = (item.fields || [])
      .filter((f) => flaggedFields[f.name])
      .map((f) => ({
        changeType: item.submissionType,
        fieldName: f.name,
        reason: fieldNotes[f.name] || "Changes requested by GP",
        currentValue: f.value,
      }));
    onSubmit(requestedChanges, generalNotes);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Changes</DialogTitle>
          <DialogDescription>
            Flag fields that need corrections from {item.investorName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {item.fields?.map((field) => (
            <div
              key={field.name}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                flaggedFields[field.name]
                  ? "border-amber-400 bg-amber-50"
                  : "border-gray-200",
              )}
            >
              <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={!!flaggedFields[field.name]}
                  onChange={(e) =>
                    setFlaggedFields((prev) => ({
                      ...prev,
                      [field.name]: e.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded accent-amber-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">{field.label}</span>
                  <p className="text-xs text-gray-500">{field.value || "—"}</p>
                </div>
              </label>
              {flaggedFields[field.name] && (
                <div className="mt-2 ml-8">
                  <Input
                    value={fieldNotes[field.name] || ""}
                    onChange={(e) =>
                      setFieldNotes((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    placeholder="Reason for change..."
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-sm">General Notes</Label>
            <Textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Additional instructions for the investor..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || flaggedCount === 0}
            className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white"
          >
            {submitting ? (
              <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <AlertTriangleIcon className="h-4 w-4 mr-2" />
            )}
            Request Changes ({flaggedCount} field{flaggedCount !== 1 ? "s" : ""})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
