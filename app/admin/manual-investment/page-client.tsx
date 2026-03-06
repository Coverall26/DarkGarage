"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTeam } from "@/context/team-context";

import {
  ManualInvestment,
  Fund,
  TabKey,
  filterByTab,
} from "./components/shared-types";
import { SummaryCards } from "./components/summary-cards";
import { InvestmentListCard } from "./components/investment-list-card";
import {
  VerifyDocModal,
  VerifyProofModal,
  RejectProofModal,
  DetailModal,
} from "./components/investment-modals";

export default function ManualInvestmentPageClient() {
  const router = useRouter();
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;

  const [investments, setInvestments] = useState<ManualInvestment[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fundFilter, setFundFilter] = useState("all");

  // Modal states
  const [verifyProofModal, setVerifyProofModal] = useState<ManualInvestment | null>(null);
  const [rejectProofModal, setRejectProofModal] = useState<ManualInvestment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [verifyDocModal, setVerifyDocModal] = useState<ManualInvestment | null>(null);
  const [detailModal, setDetailModal] = useState<ManualInvestment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch investments
  const fetchInvestments = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [investmentsRes, fundsRes] = await Promise.all([
        fetch("/api/admin/manual-investment"),
        fetch(`/api/teams/${teamId}/funds`),
      ]);

      if (investmentsRes.ok) {
        const data = await investmentsRes.json();
        setInvestments(data.investments || []);
      }

      if (fundsRes.ok) {
        const data = await fundsRes.json();
        setFunds(data.funds || []);
      }
    } catch {
      toast.error("Failed to load investment records");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  // Filter + search
  const filtered = filterByTab(investments, activeTab).filter((inv) => {
    if (fundFilter !== "all" && inv.fundId !== fundFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = inv.investor?.user?.name?.toLowerCase() || "";
      const email = inv.investor?.user?.email?.toLowerCase() || "";
      const title = inv.documentTitle?.toLowerCase() || "";
      return name.includes(q) || email.includes(q) || title.includes(q);
    }
    return true;
  });

  // Counts
  const counts = {
    all: investments.length,
    needs_review: filterByTab(investments, "needs_review").length,
    proof_uploaded: filterByTab(investments, "proof_uploaded").length,
    verified: filterByTab(investments, "verified").length,
    rejected: filterByTab(investments, "rejected").length,
  };

  // Actions
  const handleVerifyDocument = async (inv: ManualInvestment) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/manual-investment/${inv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: true, status: "APPROVED" }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error || "Failed to verify document");
        return;
      }
      toast.success("Document verified successfully");
      setVerifyDocModal(null);
      await fetchInvestments();
    } catch {
      toast.error("Error verifying document");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyProof = async (inv: ManualInvestment) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/manual-investment/${inv.id}/verify-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error || "Failed to verify proof");
        return;
      }
      toast.success("Wire proof verified successfully");
      setVerifyProofModal(null);
      await fetchInvestments();
    } catch {
      toast.error("Error verifying proof");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProof = async (inv: ManualInvestment) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/manual-investment/${inv.id}/verify-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error || "Failed to reject proof");
        return;
      }
      toast.success("Wire proof rejected");
      setRejectProofModal(null);
      setRejectReason("");
      await fetchInvestments();
    } catch {
      toast.error("Error rejecting proof");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manual Investments</h1>
          <p className="text-sm text-muted-foreground">
            Review, verify, and confirm off-platform investments and wire proofs.
          </p>
        </div>
        <Button onClick={() => router.push("/admin/manual-investment/new")}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Investment
        </Button>
      </div>

      <SummaryCards totalCount={investments.length} counts={counts} />

      <InvestmentListCard
        loading={loading}
        filtered={filtered}
        totalCount={investments.length}
        funds={funds}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        fundFilter={fundFilter}
        onFundFilterChange={setFundFilter}
        counts={counts}
        onViewDetails={(inv) => setDetailModal(inv)}
        onVerifyDoc={(inv) => setVerifyDocModal(inv)}
        onVerifyProof={(inv) => setVerifyProofModal(inv)}
        onRejectProof={(inv) => {
          setRejectProofModal(inv);
          setRejectReason("");
        }}
      />

      <VerifyDocModal
        investment={verifyDocModal}
        actionLoading={actionLoading}
        onClose={() => setVerifyDocModal(null)}
        onConfirm={handleVerifyDocument}
      />

      <VerifyProofModal
        investment={verifyProofModal}
        actionLoading={actionLoading}
        onClose={() => setVerifyProofModal(null)}
        onConfirm={handleVerifyProof}
      />

      <RejectProofModal
        investment={rejectProofModal}
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
        actionLoading={actionLoading}
        onClose={() => setRejectProofModal(null)}
        onConfirm={handleRejectProof}
      />

      <DetailModal
        investment={detailModal}
        onClose={() => setDetailModal(null)}
      />
    </div>
  );
}
