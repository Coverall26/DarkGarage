export interface FundReport {
  id: string;
  name: string;
  targetRaise: number;
  totalCommitted: number;
  totalFunded: number;
  investorCount: number;
  stages: {
    applied: number;
    underReview: number;
    approved: number;
    committed: number;
    funded: number;
    rejected: number;
  };
  conversionFunnel: {
    dataroomViews: number;
    emailsCaptured: number;
    onboardingStarted: number;
    ndaSigned: number;
    committed: number;
    funded: number;
  };
  recentActivity: Array<{
    date: string;
    type: string;
    description: string;
  }>;
}

export interface OperationalReport {
  fundId: string;
  fundName: string;
  wireReconciliation: {
    totalTransactions: number;
    completed: number;
    pending: number;
    failed: number;
    totalExpected: number;
    totalReceived: number;
    totalVariance: number;
    variancePercent: number;
    avgConfirmationDays: number | null;
    overdueCount: number;
    slaDays: number;
  };
  documentMetrics: Array<{
    type: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    completionRate: number;
    rejectionRate: number;
    avgReviewHours: number | null;
  }>;
  signatureMetrics: {
    totalRequired: number;
    completed: number;
    completionRate: number;
    avgSigningDays: number | null;
    totalRecipients: number;
    signedRecipients: number;
  };
  conversionTiming: {
    avgDaysToOnboarding: number | null;
    avgDaysToCommitted: number | null;
    avgDaysToFunded: number | null;
    totalInvestors: number;
    onboardingCompleted: number;
    ndaSigned: number;
    committed: number;
    funded: number;
  };
  sla: {
    wireConfirmation: {
      slaDays: number;
      onTrack: number;
      overdue: number;
      avgDays: number | null;
    };
    documentReview: {
      slaHours: number;
      onTrack: number;
      overdue: number;
      avgHours: number | null;
    };
    signing: {
      totalPending: number;
      avgDays: number | null;
    };
  };
  generatedAt: string;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function formatDocType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
