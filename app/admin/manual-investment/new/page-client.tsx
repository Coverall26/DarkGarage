"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  CalendarDays,
  Building2,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface FundOption {
  id: string;
  name: string;
}

interface InvestorOption {
  id: string;
  user: { name: string | null; email: string };
}

const DOCUMENT_TYPES = [
  { value: "SUBSCRIPTION", label: "Subscription Agreement" },
  { value: "LPA", label: "Limited Partnership Agreement" },
  { value: "SIDE_LETTER", label: "Side Letter" },
  { value: "SAFE", label: "SAFE Agreement" },
  { value: "CONVERTIBLE_NOTE", label: "Convertible Note" },
  { value: "OTHER", label: "Other" },
];

const TRANSFER_METHODS = [
  { value: "WIRE", label: "Wire Transfer" },
  { value: "ACH", label: "ACH" },
  { value: "CHECK", label: "Check" },
  { value: "OTHER", label: "Other" },
];

export default function NewManualInvestmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [fundId, setFundId] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [commitmentAmount, setCommitmentAmount] = useState("");
  const [fundedAmount, setFundedAmount] = useState("");
  const [units, setUnits] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [fundedDate, setFundedDate] = useState("");
  const [transferMethod, setTransferMethod] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      try {
        const ctxRes = await fetch("/api/admin/team-context", {
          signal: controller.signal,
        });
        if (ctxRes.ok) {
          const ctx = await ctxRes.json();
          if (ctx.funds) setFunds(ctx.funds);
        }

        const invRes = await fetch("/api/admin/investors?limit=200", {
          signal: controller.signal,
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData.investors) setInvestors(invData.investors);
        }
      } catch (error) {
        // Ignore abort errors
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
    return () => controller.abort();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!investorId || !fundId || !documentType || !documentTitle || !commitmentAmount || !signedDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-investment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId,
          fundId,
          documentType,
          documentTitle,
          documentNumber: documentNumber || undefined,
          commitmentAmount: parseFloat(commitmentAmount),
          fundedAmount: fundedAmount ? parseFloat(fundedAmount) : undefined,
          units: units ? parseFloat(units) : undefined,
          pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : undefined,
          signedDate,
          effectiveDate: effectiveDate || undefined,
          fundedDate: fundedDate || undefined,
          transferMethod: transferMethod || undefined,
          transferRef: transferRef || undefined,
          bankName: bankName || undefined,
          accountLast4: accountLast4 || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create investment record.");
        return;
      }

      toast.success("Manual investment created successfully.");
      router.push("/admin/manual-investment");
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/manual-investment")}
          className="min-h-[44px] min-w-[44px]"
          aria-label="Back to manual investments"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Manual Investment</h1>
          <p className="text-sm text-muted-foreground">
            Record an off-platform investment or signed document.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Investor & Fund Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" aria-hidden="true" />
              Investor &amp; Fund
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="investorId">Investor *</Label>
              {loadingData ? (
                <div className="flex h-10 items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading...
                </div>
              ) : (
                <Select value={investorId} onValueChange={setInvestorId}>
                  <SelectTrigger id="investorId" aria-label="Select investor">
                    <SelectValue placeholder="Select investor" />
                  </SelectTrigger>
                  <SelectContent>
                    {investors.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.user.name || inv.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fundId">Fund *</Label>
              {loadingData ? (
                <div className="flex h-10 items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading...
                </div>
              ) : (
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger id="fundId" aria-label="Select fund">
                    <SelectValue placeholder="Select fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {funds.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Document Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type *</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="documentType" aria-label="Select document type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentTitle">Document Title *</Label>
              <Input
                id="documentTitle"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="e.g., Subscription Agreement #12"
                className="text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="documentNumber">External Reference Number</Label>
              <Input
                id="documentNumber"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Optional reference number"
                className="text-base sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
              Financial Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="commitmentAmount">Commitment Amount ($) *</Label>
              <Input
                id="commitmentAmount"
                type="number"
                step="0.01"
                min="0"
                value={commitmentAmount}
                onChange={(e) => setCommitmentAmount(e.target.value)}
                placeholder="100000.00"
                className="font-mono text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fundedAmount">Funded Amount ($)</Label>
              <Input
                id="fundedAmount"
                type="number"
                step="0.01"
                min="0"
                value={fundedAmount}
                onChange={(e) => setFundedAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="units">Units</Label>
              <Input
                id="units"
                type="number"
                step="0.0001"
                min="0"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="Optional"
                className="font-mono text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricePerUnit">Price Per Unit ($)</Label>
              <Input
                id="pricePerUnit"
                type="number"
                step="0.0001"
                min="0"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder="Optional"
                className="font-mono text-base sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signedDate">Signed Date *</Label>
              <Input
                id="signedDate"
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fundedDate">Funded Date</Label>
              <Input
                id="fundedDate"
                type="date"
                value={fundedDate}
                onChange={(e) => setFundedDate(e.target.value)}
                className="text-base sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transfer Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Transfer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transferMethod">Transfer Method</Label>
              <Select value={transferMethod} onValueChange={setTransferMethod}>
                <SelectTrigger id="transferMethod" aria-label="Select transfer method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Optional"
                className="text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transferRef">Bank / Transaction Reference</Label>
              <Input
                id="transferRef"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                placeholder="Optional"
                className="text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountLast4">Account Last 4 Digits</Label>
              <Input
                id="accountLast4"
                value={accountLast4}
                onChange={(e) => setAccountLast4(e.target.value.slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                className="text-base sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this investment record..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/manual-investment")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Create Investment Record
          </Button>
        </div>
      </form>
    </div>
  );
}
