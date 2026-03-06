import { Suspense } from "react";
import { Metadata } from "next";
import { ComplianceDashboardClient } from "./page-client";

export const metadata: Metadata = {
  title: "SEC Compliance — FundRoom | FundRoom AI",
};

export default function CompliancePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-lg border bg-muted" />
        </div>
      }
    >
      <ComplianceDashboardClient />
    </Suspense>
  );
}
