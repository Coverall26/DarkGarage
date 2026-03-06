"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";
import { CURRENCIES } from "./step6-types";
import type { Step6Props } from "./step6-types";

interface WireSectionProps extends Step6Props {
  showAcct: boolean;
  setShowAcct: (v: boolean) => void;
  showRouting: boolean;
  setShowRouting: (v: boolean) => void;
}

export function WireSection({
  data,
  updateField,
  showAcct,
  setShowAcct,
  showRouting,
  setShowRouting,
}: WireSectionProps) {
  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Wiring Instructions
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Displayed to investors during funding step. Sensitive fields encrypted AES-256.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Bank Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="JPMorgan Chase"
            value={data.bankName}
            onChange={(e) => updateField("bankName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Account Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder={data.companyName || "Company Name"}
            value={data.accountName}
            onChange={(e) => updateField("accountName", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Account Number <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              type={showAcct ? "text" : "password"}
              placeholder="••••••••••"
              value={data.accountNumber}
              onChange={(e) => updateField("accountNumber", e.target.value)}
              className="pr-10 font-mono"
            />
            <button
              onClick={() => setShowAcct(!showAcct)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showAcct ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            <Lock size={10} className="inline mr-1" />
            Encrypted at rest
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Routing Number <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              type={showRouting ? "text" : "password"}
              placeholder="••••••••"
              value={data.routingNumber}
              onChange={(e) => updateField("routingNumber", e.target.value)}
              className="pr-10 font-mono"
            />
            <button
              onClick={() => setShowRouting(!showRouting)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showRouting ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            <Lock size={10} className="inline mr-1" />
            Encrypted at rest
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>SWIFT/BIC</Label>
          <Input
            placeholder="CHASUS33"
            value={data.swift}
            onChange={(e) => updateField("swift", e.target.value)}
          />
          <p className="text-xs text-gray-500">For international wires</p>
        </div>
        <div className="space-y-1.5">
          <Label>Memo Format</Label>
          <Input
            placeholder="[Investor Name] - [Fund Name] - [Amount]"
            value={data.memoFormat}
            onChange={(e) => updateField("memoFormat", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Intermediary Bank</Label>
          <Input
            placeholder="For international transfers"
            value={data.wireIntermediaryBank}
            onChange={(e) => updateField("wireIntermediaryBank", e.target.value)}
          />
          <p className="text-xs text-gray-500">Required for some international wires</p>
        </div>
        <div className="space-y-1.5">
          <Label>Wire Currency</Label>
          <select
            value={data.wireCurrency || data.currency || "USD"}
            onChange={(e) => updateField("wireCurrency", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Special Instructions</Label>
        <textarea
          placeholder="Additional wire instructions for investors..."
          value={data.wireSpecialInstructions}
          onChange={(e) => updateField("wireSpecialInstructions", e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 min-h-[60px] resize-none"
        />
      </div>
    </div>
  );
}
