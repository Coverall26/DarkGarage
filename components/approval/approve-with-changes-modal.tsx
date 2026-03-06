"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2Icon, Edit3Icon } from "lucide-react";
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

interface ApproveWithChangesModalProps {
  item: ApprovalItem;
  open: boolean;
  onClose: () => void;
  onSubmit: (changes: Array<{ field: string; originalValue: string; newValue: string }>, notes: string) => void;
  submitting: boolean;
}

export function ApproveWithChangesModal({
  item,
  open,
  onClose,
  onSubmit,
  submitting,
}: ApproveWithChangesModalProps) {
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && item.fields) {
      const initial: Record<string, string> = {};
      item.fields.forEach((f) => {
        initial[f.name] = f.value;
      });
      setEditedFields(initial);
      setNotes("");
    }
  }, [open, item.fields]);

  const changes = useMemo(() => {
    if (!item.fields) return [];
    return item.fields
      .filter((f) => editedFields[f.name] !== f.value)
      .map((f) => ({
        field: f.name,
        originalValue: f.value,
        newValue: editedFields[f.name] || "",
      }));
  }, [item.fields, editedFields]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve with Changes</DialogTitle>
          <DialogDescription>
            Edit fields before approving {item.investorName}&apos;s submission.
            Changes will be recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {item.fields?.filter((f) => f.editable).map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label className="text-sm">
                {field.label}
                {editedFields[field.name] !== field.value && (
                  <span className="ml-2 text-xs text-amber-600">(modified)</span>
                )}
              </Label>
              <Input
                value={editedFields[field.name] || ""}
                onChange={(e) =>
                  setEditedFields((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
                className={cn(
                  editedFields[field.name] !== field.value &&
                    "border-amber-400 bg-amber-50",
                )}
              />
              {editedFields[field.name] !== field.value && (
                <p className="text-xs text-gray-500">
                  Original: <span className="line-through">{field.value}</span>
                </p>
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-sm">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about the changes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(changes, notes)}
            disabled={submitting || changes.length === 0}
            className="min-h-[44px] bg-[#0066FF] hover:bg-[#0052cc]"
          >
            {submitting ? (
              <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Edit3Icon className="h-4 w-4 mr-2" />
            )}
            Approve with {changes.length} Change{changes.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
