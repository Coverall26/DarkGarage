"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { InvestorProfile, InvestorProfileClientProps } from "./types";
import { getAvailableTransitions } from "./types";
import {
  LoadingSkeleton,
  ErrorState,
  InvestorHeaderSection,
  SummaryMetricCards,
  StageControls,
  OverviewTab,
  InvestmentsTab,
  DocumentsTab,
  ComplianceTab,
  ActivityTab,
} from "./sections";

export default function InvestorProfileClient({ investorId }: InvestorProfileClientProps) {
  const router = useRouter();
  const [investor, setInvestor] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState("");
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchInvestor = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/investors/${investorId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Investor not found");
        }
        throw new Error("Failed to load investor profile");
      }
      const data = await res.json();
      setInvestor(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load investor");
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => {
    fetchInvestor();
  }, [fetchInvestor]);

  async function handleStageTransition(newStage: string) {
    if (!investor) return;

    setTransitioning(true);
    try {
      const res = await fetch(
        `/api/teams/${investor.teamId}/investors/${investorId}/stage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newStage,
            notes: transitionNotes || undefined,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Stage transition failed");
      }

      setTransitionNotes("");
      setShowNotesFor(null);
      await fetchInvestor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  // --- Loading state ---
  if (loading) {
    return <LoadingSkeleton />;
  }

  // --- Error state ---
  if (error || !investor) {
    return <ErrorState error={error} onGoBack={() => router.back()} />;
  }

  // --- Derived data ---
  const availableTransitions = getAvailableTransitions(investor.stage);
  const totalCommitment = investor.investments.reduce(
    (sum, inv) => sum + inv.commitmentAmount,
    0,
  );
  const totalFunded = investor.investments.reduce(
    (sum, inv) => sum + inv.fundedAmount,
    0,
  );
  const fundingPercentage = totalCommitment > 0
    ? Math.round((totalFunded / totalCommitment) * 100)
    : 0;
  const pendingDocs = investor.documents.filter(
    (d) => d.status === "UPLOADED_PENDING_REVIEW",
  ).length;

  return (
    <div className="min-h-0">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <InvestorHeaderSection
          investor={investor}
          totalCommitment={totalCommitment}
          totalFunded={totalFunded}
        />

        {/* Summary metric cards */}
        <SummaryMetricCards
          totalCommitment={totalCommitment}
          totalFunded={totalFunded}
          fundingPercentage={fundingPercentage}
          investmentCount={investor.investments.length}
          documentCount={investor.documents.length}
          pendingDocs={pendingDocs}
        />

        {/* Stage Controls */}
        <StageControls
          availableTransitions={availableTransitions}
          showNotesFor={showNotesFor}
          transitionNotes={transitionNotes}
          transitioning={transitioning}
          error={error}
          onSetShowNotesFor={setShowNotesFor}
          onSetTransitionNotes={setTransitionNotes}
          onHandleStageTransition={handleStageTransition}
        />

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="investments">
              Investments ({investor.investments.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents ({investor.documents.length})
            </TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="history">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <OverviewTab investor={investor} />
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="mt-6">
            <InvestmentsTab investments={investor.investments} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <DocumentsTab
              investor={investor}
              showUploadModal={showUploadModal}
              onSetShowUploadModal={setShowUploadModal}
              onRefresh={fetchInvestor}
            />
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="mt-6">
            <ComplianceTab investor={investor} />
          </TabsContent>

          {/* Activity / Full Audit Trail Tab */}
          <TabsContent value="history" className="mt-6">
            <ActivityTab investor={investor} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
