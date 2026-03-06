"use client";

import { Label } from "@/components/ui/label";
import { CurrencyInput } from "./step6-inputs";
import type { Step6Props } from "./step6-types";

export function SECComplianceSection({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          SEC / Investment Company Act
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Required for Form D filing and SEC compliance.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Investment Company Act Exemption</Label>
          <select
            value={data.investmentCompanyExemption}
            onChange={(e) => updateField("investmentCompanyExemption", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="">Select exemption</option>
            <option value="3C1">Section 3(c)(1) — Max 100 investors</option>
            <option value="3C7">Section 3(c)(7) — Qualified purchasers only</option>
          </select>
          <p className="text-xs text-gray-500">
            3(c)(1): up to 100 beneficial owners. 3(c)(7): unlimited qualified purchasers ($5M+ investments).
          </p>
        </div>
        <CurrencyInput
          label="Sales Commissions"
          value={data.salesCommissions}
          onChange={(v) => updateField("salesCommissions", v)}
          placeholder="0"
          helper="Form D Item 16 — Total commissions paid to placement agents or broker-dealers."
        />
      </div>
      <div className="space-y-1.5">
        <Label>Use of Proceeds</Label>
        <textarea
          placeholder="Describe intended use of proceeds (e.g., portfolio company acquisitions, working capital, follow-on investments)..."
          value={data.useOfProceeds}
          onChange={(e) => updateField("useOfProceeds", e.target.value)}
          maxLength={1000}
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 min-h-[80px] resize-none"
        />
        <p className="text-xs text-gray-500">
          Form D Item 15 — {data.useOfProceeds.length}/1000 characters.
        </p>
      </div>
    </div>
  );
}
