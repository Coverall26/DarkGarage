"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Info,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import { CurrencyInput, PctInput } from "./step6-inputs";
import {
  WATERFALL_TYPES,
  CURRENCIES,
  FUND_TYPE_CARDS,
  MARKETPLACE_CATEGORIES,
} from "./step6-types";
import type { Step6Props } from "./step6-types";

interface GPFundSectionProps extends Step6Props {
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  showMarketplace: boolean;
  setShowMarketplace: (v: boolean) => void;
  handleFundTypeSelect: (type: string) => void;
}

export function GPFundSection({
  data,
  updateField,
  showAdvanced,
  setShowAdvanced,
  showMarketplace,
  setShowMarketplace,
  handleFundTypeSelect,
}: GPFundSectionProps) {
  return (
    <div className="space-y-6">
      {/* Fund Type Selector */}
      <div className="space-y-3">
        <Label>Fund Type</Label>
        <p className="text-xs text-gray-500 -mt-1">
          Select your fund structure. Defaults will pre-fill below.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FUND_TYPE_CARDS.map((card) => {
            const Icon = card.icon;
            const isActive = data.fundSubType === card.type;
            return (
              <button
                key={card.type}
                onClick={() => handleFundTypeSelect(card.type)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                  isActive
                    ? "border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700",
                )}
              >
                <Icon
                  size={16}
                  className={cn("mb-1", isActive ? "text-[#0066FF]" : "text-gray-400")}
                />
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {card.title}
                </span>
                <span className="text-xs text-gray-400 mt-0.5">
                  {card.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>
            Fund Name <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="Growth Fund I"
            value={data.fundName}
            onChange={(e) => updateField("fundName", e.target.value)}
            className="text-base sm:text-sm"
          />
          <p className="text-xs text-gray-500">
            Used in all docs, investor portal, and Form D
          </p>
        </div>
        <CurrencyInput
          label="Target Raise"
          required
          placeholder="10,000,000"
          value={data.targetRaise}
          onChange={(v) => updateField("targetRaise", v)}
        />
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <select
            value={data.currency}
            onChange={(e) => updateField("currency", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <CurrencyInput
        label="Minimum Investor Commitment"
        placeholder="50,000"
        value={data.minimumCommitment}
        onChange={(v) => updateField("minimumCommitment", v)}
        helper="Minimum commitment amount per investor"
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <PctInput
          label="Management Fee"
          placeholder="2.0"
          value={data.mgmtFee}
          onChange={(v) => updateField("mgmtFee", v)}
          helper="Standard 2/20 structure"
        />
        <PctInput
          label="Carried Interest"
          placeholder="20.0"
          value={data.carry}
          onChange={(v) => updateField("carry", v)}
          helper="GP profit share above hurdle"
        />
        <PctInput
          label="Hurdle Rate"
          placeholder="8.0"
          value={data.hurdle}
          onChange={(v) => updateField("hurdle", v)}
          helper="Preferred return threshold"
        />
        <div className="space-y-1.5">
          <Label>Fund Term</Label>
          <div className="relative">
            <Input
              type="text"
              placeholder="10"
              value={data.fundTerm}
              onChange={(e) => updateField("fundTerm", e.target.value)}
              className="pr-14 text-base sm:text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              years
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Waterfall Type</Label>
          <select
            value={data.waterfallType}
            onChange={(e) => updateField("waterfallType", e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="">Select type</option>
            {WATERFALL_TYPES.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Extension Years</Label>
          <div className="relative">
            <Input
              type="text"
              placeholder="2"
              value={data.extensionYears}
              onChange={(e) => updateField("extensionYears", e.target.value)}
              className="pr-14 text-base sm:text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              years
            </span>
          </div>
          <p className="text-xs text-gray-500">Optional fund extension period</p>
        </div>
        <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px] self-end">
          <div>
            <p className="text-sm font-medium">High Water Mark</p>
            <p className="text-xs text-gray-500">Hedge fund style</p>
          </div>
          <Switch
            checked={data.highWaterMark}
            onCheckedChange={(v) => updateField("highWaterMark", v)}
          />
        </div>
      </div>

      {/* Advanced Fund Settings (collapsed) */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full px-4 py-3 text-left min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Advanced fund settings
            </span>
          </div>
          {showAdvanced ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 space-y-4 border-t">
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <CurrencyInput
                label="GP Commitment"
                placeholder="500,000"
                value={data.gpCommitment}
                onChange={(v) => updateField("gpCommitment", v)}
                helper="GP's own commitment to the fund"
              />
              <div className="space-y-1.5">
                <Label>Investment Period</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="5"
                    value={data.investmentPeriod}
                    onChange={(e) => updateField("investmentPeriod", e.target.value)}
                    className="pr-14 text-base sm:text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    years
                  </span>
                </div>
                <p className="text-xs text-gray-500">Active investment period before harvest</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
                <div>
                  <p className="text-sm font-medium">Recycling Provisions</p>
                  <p className="text-xs text-gray-500">Reinvest proceeds during investment period</p>
                </div>
                <Switch
                  checked={data.recyclingEnabled}
                  onCheckedChange={(v) => updateField("recyclingEnabled", v)}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
                <div>
                  <p className="text-sm font-medium">Clawback Provision</p>
                  <p className="text-xs text-gray-500">GP returns excess carry distributions</p>
                </div>
                <Switch
                  checked={data.clawbackProvision}
                  onCheckedChange={(v) => updateField("clawbackProvision", v)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 min-h-[44px]">
                <div>
                  <p className="text-sm font-medium">Key Person Clause</p>
                  <p className="text-xs text-gray-500">Suspension trigger if key person departs</p>
                </div>
                <Switch
                  checked={data.keyPersonEnabled}
                  onCheckedChange={(v) => updateField("keyPersonEnabled", v)}
                />
              </div>
              {data.keyPersonEnabled && (
                <div className="pl-4">
                  <Label>Key Person Name</Label>
                  <Input
                    placeholder="Managing Partner name"
                    value={data.keyPersonName}
                    onChange={(e) => updateField("keyPersonName", e.target.value)}
                    className="mt-1 text-base sm:text-sm"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <PctInput
                label="No-Fault Divorce"
                placeholder="66.7"
                value={data.noFaultDivorceThreshold}
                onChange={(v) => updateField("noFaultDivorceThreshold", v)}
                helper="Investor vote threshold to remove GP"
              />
              <PctInput
                label="Mgmt Fee Offset"
                placeholder="100"
                value={data.mgmtFeeOffset}
                onChange={(v) => updateField("mgmtFeeOffset", v)}
                helper="% of portfolio co fees offsetting mgmt fee"
              />
              <div className="space-y-1.5">
                <Label>Preferred Return</Label>
                <select
                  value={data.preferredReturnMethod}
                  onChange={(e) => updateField("preferredReturnMethod", e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="COMPOUNDED">Compounded</option>
                  <option value="SIMPLE">Simple</option>
                </select>
                <p className="text-xs text-gray-500">Hurdle rate calculation method</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Marketplace Section (collapsed) */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => {
            setShowMarketplace(!showMarketplace);
            if (!showMarketplace) updateField("marketplaceInterest", true);
          }}
          className="flex items-center justify-between w-full px-4 py-3 text-left min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Marketplace Listing
            </span>
            <span className="px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
              Coming Soon
            </span>
          </div>
          {showMarketplace ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>
        {showMarketplace && (
          <div className="px-4 pb-4 space-y-4 border-t mt-0 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Opt in to marketplace</p>
                <p className="text-xs text-gray-500">Make your fund discoverable to qualified investors</p>
              </div>
              <Switch
                checked={data.marketplaceInterest}
                onCheckedChange={(v) => updateField("marketplaceInterest", v)}
              />
            </div>
            {data.marketplaceInterest && (
              <>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <textarea
                    maxLength={280}
                    placeholder="Brief description for potential investors..."
                    value={data.marketplaceDescription}
                    onChange={(e) => updateField("marketplaceDescription", e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 min-h-[80px] resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right">
                    {data.marketplaceDescription.length}/280
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    value={data.marketplaceCategory}
                    onChange={(e) => updateField("marketplaceCategory", e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#0066FF] focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  >
                    <option value="">Select category</option>
                    {MARKETPLACE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
