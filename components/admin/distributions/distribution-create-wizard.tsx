"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";

interface DistributionCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  teamId: string;
  fundId: string;
}

const DISTRIBUTION_TYPES = [
  { value: "DIVIDEND", label: "Dividend" },
  { value: "RETURN_OF_CAPITAL", label: "Return of Capital" },
  { value: "INTEREST", label: "Interest" },
  { value: "OTHER", label: "Other" },
];

export function DistributionCreateWizard({
  open,
  onClose,
  onCreated,
  teamId,
  fundId,
}: DistributionCreateWizardProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [totalAmount, setTotalAmount] = useState("");
  const [distributionType, setDistributionType] = useState("DIVIDEND");
  const [distributionDate, setDistributionDate] = useState("");
  const [notes, setNotes] = useState("");

  const STEPS = ["Type & Amount", "Date & Notes", "Review & Create"];

  function resetForm() {
    setStep(0);
    setTotalAmount("");
    setDistributionType("DIVIDEND");
    setDistributionDate("");
    setNotes("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function canProceed(): boolean {
    if (step === 0) {
      const amt = parseFloat(totalAmount);
      return (
        !isNaN(amt) &&
        amt > 0 &&
        amt <= 100_000_000_000 &&
        !!distributionType
      );
    }
    if (step === 1) {
      return !!distributionDate && !isNaN(new Date(distributionDate).getTime());
    }
    return true;
  }

  async function handleCreate() {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/teams/${teamId}/funds/${fundId}/distributions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: parseFloat(totalAmount),
            distributionType,
            distributionDate,
            notes: notes || undefined,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create distribution");
        return;
      }

      resetForm();
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const formatAmount = (v: string) => {
    const num = parseFloat(v);
    if (isNaN(num)) return "$0.00";
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const typeLabel =
    DISTRIBUTION_TYPES.find((t) => t.value === distributionType)?.label ||
    distributionType;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            Create Distribution
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step
                  ? "bg-emerald-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        <div className="min-h-[240px] py-2">
          {/* Step 1: Type & Amount */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="distType">
                  <FileText className="h-4 w-4 inline mr-1" aria-hidden="true" />
                  Distribution Type
                </Label>
                <Select value={distributionType} onValueChange={setDistributionType}>
                  <SelectTrigger id="distType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRIBUTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="distAmount">
                  <ArrowDownToLine className="h-4 w-4 inline mr-1" aria-hidden="true" />
                  Total Amount ($)
                </Label>
                <Input
                  id="distAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="250000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="font-mono tabular-nums text-base"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Total amount to distribute across all investors.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Date & Notes */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="distDate">
                  <Calendar className="h-4 w-4 inline mr-1" aria-hidden="true" />
                  Distribution Date
                </Label>
                <Input
                  id="distDate"
                  type="date"
                  value={distributionDate}
                  onChange={(e) => setDistributionDate(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="distNotes">Notes (optional)</Label>
                <Textarea
                  id="distNotes"
                  placeholder="Additional context or memo for this distribution..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 2 && (
            <div className="space-y-3">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Review Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span className="text-sm font-medium">{typeLabel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatAmount(totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="text-sm">
                      {distributionDate
                        ? new Date(distributionDate + "T00:00:00").toLocaleDateString(
                            "en-US",
                            { year: "numeric", month: "long", day: "numeric" },
                          )
                        : "—"}
                    </span>
                  </div>
                  {notes && (
                    <div className="pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Notes</span>
                      <p className="text-sm mt-1">{notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
                <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  The distribution will be created in <strong>DRAFT</strong> status.
                  You can review and approve it before execution.
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={submitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                Create Draft
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
