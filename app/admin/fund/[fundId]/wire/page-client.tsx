"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { putFile } from "@/lib/files/put-file";
import type { WireInstructions, PendingTransaction, ConfirmForm } from "./components/types";
import { WireInstructionsForm } from "./components/wire-instructions-form";
import { PendingConfirmations } from "./components/pending-confirmations";

interface WireInstructionsClientProps {
  fundId: string;
}

export default function WireInstructionsClient({
  fundId,
}: WireInstructionsClientProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"instructions" | "confirm">(
    "instructions",
  );
  const [form, setForm] = useState<WireInstructions>({
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
    beneficiaryName: "",
    beneficiaryAddress: "",
    reference: "",
    notes: "",
  });

  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmForm>({
    fundsReceivedDate: new Date().toISOString().split("T")[0],
    amountReceived: "",
    bankReference: "",
    confirmationNotes: "",
    confirmed: false,
    bankStatementFileName: "",
  });
  const [bankStatementUploading, setBankStatementUploading] = useState(false);
  const bankStatementRef = useRef<HTMLInputElement>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const fundRes = await fetch(`/api/admin/fund/${fundId}`);
      if (!fundRes.ok) throw new Error("Fund not found");
      const fundData = await fundRes.json();
      const tid = fundData.teamId;
      setTeamId(tid);

      const res = await fetch(
        `/api/teams/${tid}/funds/${fundId}/wire-instructions`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.configured && data.instructions) {
          setForm(data.instructions);
          setConfigured(true);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fundId]);

  const fetchPendingTransactions = useCallback(async () => {
    if (!teamId) return;
    setLoadingTransactions(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/funds/${fundId}/transactions?status=PENDING&status=PROOF_UPLOADED`,
      );
      if (res.ok) {
        const data = await res.json();
        setPendingTransactions(data.transactions || []);
      }
    } catch {
      // Silently fail — pending list is supplementary
    } finally {
      setLoadingTransactions(false);
    }
  }, [teamId, fundId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (teamId && activeTab === "confirm") {
      fetchPendingTransactions();
    }
  }, [teamId, activeTab, fetchPendingTransactions]);

  // ---------------------------------------------------------------------------
  // Wire Instructions Handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!teamId) return;

    if (
      !form.bankName ||
      !form.accountNumber ||
      !form.routingNumber ||
      !form.beneficiaryName
    ) {
      setError(
        "Bank name, account number, routing number, and beneficiary name are required",
      );
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(
        `/api/teams/${teamId}/funds/${fundId}/wire-instructions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      setConfigured(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!teamId || !confirm("Remove wire instructions from this fund?")) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/funds/${fundId}/wire-instructions`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");

      setForm({
        bankName: "",
        accountNumber: "",
        routingNumber: "",
        swiftCode: "",
        beneficiaryName: "",
        beneficiaryAddress: "",
        reference: "",
        notes: "",
      });
      setConfigured(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof WireInstructions, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // Confirmation Handlers
  // ---------------------------------------------------------------------------

  function startConfirm(tx: PendingTransaction) {
    setConfirmingId(tx.id);
    setConfirmForm({
      fundsReceivedDate: new Date().toISOString().split("T")[0],
      amountReceived: String(tx.amount),
      bankReference: "",
      confirmationNotes: "",
      confirmed: false,
      bankStatementFileName: "",
    });
    setError("");
  }

  function cancelConfirm() {
    setConfirmingId(null);
    setError("");
  }

  async function handleBankStatementUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !teamId) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted for bank statements");
      return;
    }

    setBankStatementUploading(true);
    setError("");
    try {
      const uploadResult = await putFile({ file, teamId });
      if (uploadResult.type && uploadResult.data) {
        setConfirmForm((prev) => ({
          ...prev,
          bankStatementFileName: file.name,
        }));
      }
    } catch {
      setError("Failed to upload bank statement");
    } finally {
      setBankStatementUploading(false);
    }
  }

  async function handleConfirm(transactionId: string) {
    if (!teamId) return;

    const amountNum = parseFloat(confirmForm.amountReceived);
    if (!confirmForm.fundsReceivedDate) {
      setError("Funds received date is required");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Amount received must be a positive number");
      return;
    }
    if (!confirmForm.confirmed) {
      setError("Please confirm that funds have been received in the fund account");
      return;
    }

    setConfirmLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/wire/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          teamId,
          fundsReceivedDate: new Date(
            confirmForm.fundsReceivedDate,
          ).toISOString(),
          amountReceived: amountNum,
          bankReference: confirmForm.bankReference || undefined,
          confirmationNotes: confirmForm.confirmationNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Confirmation failed");
      }

      setPendingTransactions((prev) =>
        prev.filter((t) => t.id !== transactionId),
      );
      setConfirmingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setConfirmLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/admin/fund/${fundId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Fund
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Wire Transfers</h1>
          <p className="text-muted-foreground">
            Configure wire instructions and confirm incoming transfers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {configured && (
            <Badge variant="default" className="bg-emerald-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Coming soon — QuickBooks integration launching Q2 2026"
            className="opacity-50 cursor-not-allowed"
          >
            <Building2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Sync to QuickBooks
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant={activeTab === "instructions" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setActiveTab("instructions");
            setError("");
          }}
        >
          <Banknote className="h-4 w-4 mr-2" />
          Wire Instructions
        </Button>
        <Button
          variant={activeTab === "confirm" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setActiveTab("confirm");
            setError("");
          }}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Confirm Receipt
          {pendingTransactions.length > 0 && (
            <Badge className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0">
              {pendingTransactions.length}
            </Badge>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 mb-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-red-600 hover:text-red-700"
            onClick={() => setError("")}
          >
            Dismiss
          </Button>
        </div>
      )}

      {activeTab === "instructions" ? (
        <WireInstructionsForm
          form={form}
          configured={configured}
          saving={saving}
          saved={saved}
          onUpdateField={updateField}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : (
        <PendingConfirmations
          transactions={pendingTransactions}
          loading={loadingTransactions}
          confirmingId={confirmingId}
          confirmForm={confirmForm}
          confirmLoading={confirmLoading}
          bankStatementUploading={bankStatementUploading}
          bankStatementRef={bankStatementRef}
          onConfirmFormChange={(field, value) =>
            setConfirmForm((prev) => ({ ...prev, [field]: value }))
          }
          onConfirmCheckedChange={(checked) =>
            setConfirmForm((prev) => ({ ...prev, confirmed: checked }))
          }
          onBankStatementUpload={handleBankStatementUpload}
          onStartConfirm={startConfirm}
          onCancelConfirm={cancelConfirm}
          onConfirm={handleConfirm}
          onRefresh={fetchPendingTransactions}
        />
      )}
    </div>
  );
}
