"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { CurrencyInput, PctInput } from "./step6-inputs";
import { INSTRUMENTS } from "./step6-types";
import type { Step6Props } from "./step6-types";

export function StartupSection({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INSTRUMENTS.map((inst) => {
          const Icon = inst.icon;
          const isSelected = data.instrumentType === inst.value;
          return (
            <button
              key={inst.value}
              onClick={() => updateField("instrumentType", inst.value)}
              className={cn(
                "relative flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all",
                isSelected
                  ? "border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700",
              )}
            >
              {isSelected && (
                <Check size={14} className="absolute top-2 right-2 text-[#0066FF]" />
              )}
              <Icon
                size={20}
                className={cn("mb-2", isSelected ? "text-[#0066FF]" : "text-gray-400")}
              />
              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {inst.label}
              </h4>
              <p className="text-xs text-gray-500 mt-1">{inst.desc}</p>
            </button>
          );
        })}
      </div>

      {/* SAFE Fields */}
      {data.instrumentType === "SAFE" && (
        <SAFEFields data={data} updateField={updateField} />
      )}

      {/* Convertible Note Fields */}
      {data.instrumentType === "CONVERTIBLE_NOTE" && (
        <ConvertibleNoteFields data={data} updateField={updateField} />
      )}

      {/* Priced Round Fields */}
      {data.instrumentType === "PRICED_ROUND" && (
        <PricedRoundFields data={data} updateField={updateField} />
      )}

      {/* SPV Fields */}
      {data.instrumentType === "SPV" && (
        <SPVFields data={data} updateField={updateField} />
      )}
    </div>
  );
}

function SAFEFields({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Round Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Pre-Seed"
            value={data.roundName}
            onChange={(e) => updateField("roundName", e.target.value)}
          />
        </div>
        <CurrencyInput
          label="Target Raise"
          required
          placeholder="1,000,000"
          value={data.targetRaise}
          onChange={(v) => updateField("targetRaise", v)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Valuation Cap"
          required
          placeholder="10,000,000"
          value={data.valCap}
          onChange={(v) => updateField("valCap", v)}
          helper="Max valuation at which SAFE converts"
        />
        <PctInput
          label="Discount Rate"
          placeholder="20"
          value={data.discount}
          onChange={(v) => updateField("discount", v)}
          helper="15-25% typical"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>SAFE Type</Label>
          <select
            value={data.safeType}
            onChange={(e) => updateField("safeType", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="POST_MONEY">Post-Money</option>
            <option value="PRE_MONEY">Pre-Money</option>
          </select>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={data.mfn} onCheckedChange={(v) => updateField("mfn", v)} />
          <div>
            <p className="text-sm font-medium">MFN</p>
            <p className="text-xs text-gray-500">Auto-inherits better terms</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={data.proRata} onCheckedChange={(v) => updateField("proRata", v)} />
          <div>
            <p className="text-sm font-medium">Pro-Rata Rights</p>
            <p className="text-xs text-gray-500">Right to invest in future</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConvertibleNoteFields({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Target Raise"
          required
          placeholder="500,000"
          value={data.targetRaise}
          onChange={(v) => updateField("targetRaise", v)}
        />
        <PctInput
          label="Interest Rate"
          required
          placeholder="5.0"
          value={data.interestRate}
          onChange={(v) => updateField("interestRate", v)}
          helper="Annual simple interest. 2-8% typical."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Maturity Date</Label>
          <Input
            type="date"
            value={data.maturityDate}
            onChange={(e) => updateField("maturityDate", e.target.value)}
          />
          <p className="text-xs text-gray-500">12-24 months typical</p>
        </div>
        <CurrencyInput
          label="Qualified Financing Threshold"
          placeholder="1,000,000"
          value={data.qualFinancing}
          onChange={(v) => updateField("qualFinancing", v)}
          helper="Min raise to trigger auto-conversion"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Valuation Cap"
          placeholder="10,000,000"
          value={data.valCap}
          onChange={(v) => updateField("valCap", v)}
        />
        <PctInput
          label="Discount Rate"
          placeholder="20"
          value={data.discount}
          onChange={(v) => updateField("discount", v)}
        />
      </div>
    </div>
  );
}

function PricedRoundFields({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Round Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Series A"
            value={data.roundName}
            onChange={(e) => updateField("roundName", e.target.value)}
          />
        </div>
        <CurrencyInput
          label="Target Raise"
          required
          placeholder="5,000,000"
          value={data.targetRaise}
          onChange={(v) => updateField("targetRaise", v)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Pre-Money Valuation"
          required
          placeholder="20,000,000"
          value={data.preMoneyVal}
          onChange={(v) => updateField("preMoneyVal", v)}
        />
        <div className="space-y-1.5">
          <Label>Liquidation Preference</Label>
          <select
            value={data.liqPref}
            onChange={(e) => updateField("liqPref", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="1X_NON_PARTICIPATING">1x Non-Participating</option>
            <option value="1X_PARTICIPATING">1x Participating</option>
            <option value="2X_NON_PARTICIPATING">2x Non-Participating</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Anti-Dilution</Label>
          <select
            value={data.antiDilution}
            onChange={(e) => updateField("antiDilution", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="BROAD_BASED_WEIGHTED_AVG">Broad-Based Weighted Average</option>
            <option value="FULL_RATCHET">Full Ratchet</option>
          </select>
        </div>
        <PctInput
          label="Option Pool"
          placeholder="10"
          value={data.optionPool}
          onChange={(v) => updateField("optionPool", v)}
          helper="ESOP reserved. 10-20% typical."
        />
        <div className="space-y-1.5">
          <Label>Board Seats</Label>
          <Input
            type="number"
            placeholder="1"
            value={data.boardSeats}
            onChange={(e) => updateField("boardSeats", e.target.value)}
            className="text-base sm:text-sm"
          />
          <p className="text-xs text-gray-500">Investor board seats</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
          <div>
            <p className="text-sm font-medium">Protective Provisions</p>
            <p className="text-xs text-gray-500">Investor veto on major changes</p>
          </div>
          <Switch checked={data.protectiveProvisions} onCheckedChange={(v) => updateField("protectiveProvisions", v)} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
          <div>
            <p className="text-sm font-medium">Information Rights</p>
            <p className="text-xs text-gray-500">Financial statements access</p>
          </div>
          <Switch checked={data.informationRights} onCheckedChange={(v) => updateField("informationRights", v)} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
          <div>
            <p className="text-sm font-medium">ROFR &amp; Co-Sale</p>
            <p className="text-xs text-gray-500">Right of first refusal + co-sale rights</p>
          </div>
          <Switch checked={data.rofrCoSale} onCheckedChange={(v) => updateField("rofrCoSale", v)} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
          <div>
            <p className="text-sm font-medium">Drag-Along</p>
            <p className="text-xs text-gray-500">Force minority to sell</p>
          </div>
          <Switch checked={data.dragAlong} onCheckedChange={(v) => updateField("dragAlong", v)} />
        </div>
      </div>
    </div>
  );
}

function SPVFields({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>SPV Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Acme Co-Invest SPV LLC"
            value={data.spvName}
            onChange={(e) => updateField("spvName", e.target.value)}
          />
          <p className="text-xs text-gray-500">Legal entity name for the SPV</p>
        </div>
        <div className="space-y-1.5">
          <Label>Target Company <span className="text-red-500">*</span></Label>
          <Input
            placeholder="Target Company Inc."
            value={data.targetCompanyName}
            onChange={(e) => updateField("targetCompanyName", e.target.value)}
          />
          <p className="text-xs text-gray-500">Company being invested in</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Deal Description</Label>
        <textarea
          maxLength={280}
          placeholder="Describe the deal and investment thesis..."
          value={data.dealDescription}
          onChange={(e) => updateField("dealDescription", e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 min-h-[80px] resize-none"
        />
        <p className="text-xs text-gray-400 text-right">{data.dealDescription.length}/280</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          label="Total Allocation"
          required
          placeholder="2,000,000"
          value={data.allocationAmount}
          onChange={(v) => updateField("allocationAmount", v)}
          helper="Total SPV allocation"
        />
        <CurrencyInput
          label="Minimum Investor Investment"
          placeholder="25,000"
          value={data.minimumLpInvestment}
          onChange={(v) => updateField("minimumLpInvestment", v)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PctInput
          label="Management Fee"
          placeholder="0"
          value={data.spvMgmtFee}
          onChange={(v) => updateField("spvMgmtFee", v)}
          helper="0-2% typical for SPVs"
        />
        <PctInput
          label="Carried Interest"
          placeholder="20"
          value={data.spvCarry}
          onChange={(v) => updateField("spvCarry", v)}
          helper="GP profit share"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CurrencyInput
          label="GP Commitment"
          placeholder="50,000"
          value={data.spvGpCommitment}
          onChange={(v) => updateField("spvGpCommitment", v)}
        />
        <div className="space-y-1.5">
          <Label>Max Investors</Label>
          <Input
            type="number"
            placeholder="99"
            value={data.maxInvestors}
            onChange={(e) => updateField("maxInvestors", e.target.value)}
            className="text-base sm:text-sm"
          />
          <p className="text-xs text-gray-500">249 max for Reg D</p>
        </div>
        <div className="space-y-1.5">
          <Label>SPV Term</Label>
          <select
            value={data.spvTerm}
            onChange={(e) => updateField("spvTerm", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="">Select term</option>
            <option value="DEAL_COMPLETION">Deal completion</option>
            <option value="1_YEAR">1 year</option>
            <option value="3_YEARS">3 years</option>
            <option value="5_YEARS">5 years</option>
            <option value="10_YEARS">10 years</option>
          </select>
        </div>
      </div>
    </div>
  );
}
