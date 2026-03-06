"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Users,
  DollarSign,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { formatCurrency } from "./types";

interface InvestorStatsCardsProps {
  totalInvestors: number;
  totalCommitted: number;
  totalFunded: number;
  stageCounts: Record<string, number>;
}

export function InvestorStatsCards({
  totalInvestors,
  totalCommitted,
  totalFunded,
  stageCounts,
}: InvestorStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-l-4 border-l-[#0066FF]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-[#0066FF]" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Total Investors</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">{totalInvestors}</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Total Committed</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(totalCommitted)}</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-[#10B981]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Total Funded</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(totalFunded)}</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-[#F59E0B]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Approved+</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {(stageCounts.APPROVED || 0) +
              (stageCounts.COMMITTED || 0) +
              (stageCounts.DOCS_APPROVED || 0) +
              (stageCounts.FUNDED || 0)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
