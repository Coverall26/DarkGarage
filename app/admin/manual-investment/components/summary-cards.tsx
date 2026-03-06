"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  Upload,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { TabCounts } from "./shared-types";

export function SummaryCards({
  totalCount,
  counts,
}: {
  totalCount: number;
  counts: TabCounts;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
              <FileText className="h-5 w-5 text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {totalCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-900/20">
              <Clock className="h-5 w-5 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Needs Review</p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {counts.needs_review}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-900/20">
              <Upload className="h-5 w-5 text-purple-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Proof Uploaded</p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {counts.proof_uploaded}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-900/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {counts.verified}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
