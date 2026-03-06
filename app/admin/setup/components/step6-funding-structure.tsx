"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput, PctInput } from "./step6-inputs";
import { FundingStructurePreview } from "@/components/admin/funding-structure-preview";
import type { Step6Props } from "./step6-types";

interface FundingStructureSectionProps extends Step6Props {
  isStartup: boolean;
  isGPFund: boolean;
  showFundingStructure: boolean;
  setShowFundingStructure: (v: boolean) => void;
}

export function FundingStructureSection({
  data,
  updateField,
  isStartup,
  isGPFund,
  showFundingStructure,
  setShowFundingStructure,
}: FundingStructureSectionProps) {
  return (
    <div className="space-y-4 border-t pt-6">
      <button
        type="button"
        onClick={() => setShowFundingStructure(!showFundingStructure)}
        className="flex items-center justify-between w-full"
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 size={18} className="text-[#0066FF]" />
            Funding Structure
          </h3>
          <p className="text-xs text-gray-500 mt-1 text-left">
            {isStartup
              ? "Plan future funding rounds beyond your initial round."
              : "Configure initial pricing tiers for unit-based fundraising."}
          </p>
        </div>
        {showFundingStructure ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {showFundingStructure && isStartup && (
        <StartupFundingRounds data={data} updateField={updateField} />
      )}

      {showFundingStructure && isGPFund && (
        <GPFundPricingTiers data={data} updateField={updateField} />
      )}

      {/* Inline Preview Chart */}
      {showFundingStructure && (
        <FundingStructurePreview
          mode={data.raiseMode as "GP_FUND" | "STARTUP" | ""}
          tiers={(data.initialTiers || []).map((t) => ({
            tranche: t.tranche,
            name: t.name,
            pricePerUnit: t.pricePerUnit,
            unitsAvailable: t.unitsAvailable,
          }))}
          rounds={[
            ...(data.roundName
              ? [
                  {
                    roundName: data.roundName || "Seed Round",
                    targetAmount: data.targetRaise || "0",
                    instrumentType: data.instrumentType || "SAFE",
                    valuationCap: data.valCap || "",
                    discount: data.discount || "",
                    status: "ACTIVE" as const,
                  },
                ]
              : []),
            ...(data.plannedRounds || []).map((r) => ({
              roundName: r.roundName,
              targetAmount: r.targetAmount,
              instrumentType: r.instrumentType,
              valuationCap: r.valuationCap,
              discount: r.discount,
              status: "PLANNED" as const,
            })),
          ]}
        />
      )}
    </div>
  );
}

function StartupFundingRounds({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 pt-2">
      {/* Have you raised before? */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Have you raised before?
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Add completed rounds to show your fundraising history.
          </p>
        </div>
        <Switch
          checked={
            (data.plannedRounds || []).some(
              (r) => r.roundName && r.targetAmount,
            ) || false
          }
          onCheckedChange={(checked) => {
            if (checked && (!data.plannedRounds || data.plannedRounds.length === 0)) {
              updateField("plannedRounds", [
                {
                  roundName: "Pre-Seed",
                  targetAmount: "",
                  instrumentType: "SAFE",
                  valuationCap: "",
                  discount: "20",
                  notes: "",
                },
              ]);
            } else if (!checked) {
              updateField("plannedRounds", []);
            }
          }}
        />
      </div>

      {/* Active Round Summary */}
      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#0066FF]" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Active: {data.roundName || "Seed Round"}
          </span>
          <span className="text-xs text-gray-500">
            {data.instrumentType || "SAFE"}
          </span>
        </div>
        <p className="text-xs text-gray-500 pl-4">
          Target: {data.targetRaise ? `$${data.targetRaise}` : "Not set"}
          {data.valCap && ` · Val Cap: $${data.valCap}`}
          {data.discount && ` · Discount: ${data.discount}%`}
        </p>
      </div>

      {/* Planned Rounds */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Planned Future Rounds
          </h4>
          <button
            type="button"
            onClick={() => {
              const newRounds = [
                ...(data.plannedRounds || []),
                {
                  roundName: "",
                  targetAmount: "",
                  instrumentType: "SAFE",
                  valuationCap: "",
                  discount: "",
                  notes: "",
                },
              ];
              updateField("plannedRounds", newRounds);
            }}
            className="flex items-center gap-1 text-xs text-[#0066FF] hover:text-blue-700 font-medium"
          >
            <Plus size={14} /> Add Round
          </button>
        </div>

        {(!data.plannedRounds || data.plannedRounds.length === 0) && (
          <p className="text-xs text-gray-400 italic py-2">
            No planned rounds yet. Add future rounds to preview your fundraising roadmap.
          </p>
        )}

        {(data.plannedRounds || []).map((round, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Planned Round {idx + 2}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = [...(data.plannedRounds || [])];
                  updated.splice(idx, 1);
                  updateField("plannedRounds", updated);
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Round Name</Label>
                <Input
                  placeholder="Series A"
                  value={round.roundName}
                  onChange={(e) => {
                    const updated = [...(data.plannedRounds || [])];
                    updated[idx] = { ...updated[idx], roundName: e.target.value };
                    updateField("plannedRounds", updated);
                  }}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instrument</Label>
                <select
                  value={round.instrumentType}
                  onChange={(e) => {
                    const updated = [...(data.plannedRounds || [])];
                    updated[idx] = { ...updated[idx], instrumentType: e.target.value };
                    updateField("plannedRounds", updated);
                  }}
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="SAFE">SAFE</option>
                  <option value="CONVERTIBLE_NOTE">Convertible Note</option>
                  <option value="PRICED_ROUND">Priced Round</option>
                  <option value="SPV">SPV</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <CurrencyInput
                label="Target Amount"
                placeholder="5,000,000"
                value={round.targetAmount}
                onChange={(v) => {
                  const updated = [...(data.plannedRounds || [])];
                  updated[idx] = { ...updated[idx], targetAmount: v };
                  updateField("plannedRounds", updated);
                }}
              />
              <CurrencyInput
                label="Valuation Cap"
                placeholder="20,000,000"
                value={round.valuationCap}
                onChange={(v) => {
                  const updated = [...(data.plannedRounds || [])];
                  updated[idx] = { ...updated[idx], valuationCap: v };
                  updateField("plannedRounds", updated);
                }}
              />
              <PctInput
                label="Discount"
                placeholder="20"
                value={round.discount}
                onChange={(v) => {
                  const updated = [...(data.plannedRounds || [])];
                  updated[idx] = { ...updated[idx], discount: v };
                  updateField("plannedRounds", updated);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
        <Info size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-500">
          Planned rounds are created with &quot;Planned&quot; status. You can activate and configure them later from Fund Settings.
        </p>
      </div>
    </div>
  );
}

function GPFundPricingTiers({ data, updateField }: Step6Props) {
  return (
    <div className="space-y-4 pt-2">
      {/* Tier Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Pricing Tiers
          </h4>
          <button
            type="button"
            onClick={() => {
              const tiers = data.initialTiers || [];
              const nextTranche = tiers.length > 0
                ? Math.max(...tiers.map((t) => t.tranche)) + 1
                : 1;
              updateField("initialTiers", [
                ...tiers,
                {
                  tranche: nextTranche,
                  name: `Tranche ${nextTranche}`,
                  pricePerUnit: "",
                  unitsAvailable: "",
                },
              ]);
            }}
            className="flex items-center gap-1 text-xs text-[#0066FF] hover:text-blue-700 font-medium"
          >
            <Plus size={14} /> Add Tier
          </button>
        </div>

        {(!data.initialTiers || data.initialTiers.length === 0) && (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-gray-400 italic">
              No pricing tiers configured. Add tiers to set up unit-based pricing for your fund.
            </p>
            <button
              type="button"
              onClick={() => {
                updateField("initialTiers", [
                  { tranche: 1, name: "Early Investor", pricePerUnit: "90,000", unitsAvailable: "25" },
                  { tranche: 2, name: "Standard", pricePerUnit: "95,000", unitsAvailable: "25" },
                  { tranche: 3, name: "Late Close", pricePerUnit: "100,000", unitsAvailable: "20" },
                ]);
                toast.success("Default pricing tiers added — adjust to fit your fund.");
              }}
              className="text-xs text-[#0066FF] hover:text-blue-700 font-medium underline underline-offset-2"
            >
              Pre-populate with suggested defaults
            </button>
          </div>
        )}

        {(data.initialTiers || []).map((tier, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Tier {tier.tranche}
              </span>
              <button
                type="button"
                onClick={() => {
                  const updated = [...(data.initialTiers || [])];
                  updated.splice(idx, 1);
                  updateField("initialTiers", updated);
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="Early Investor"
                  value={tier.name}
                  onChange={(e) => {
                    const updated = [...(data.initialTiers || [])];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    updateField("initialTiers", updated);
                  }}
                  className="text-sm"
                />
              </div>
              <CurrencyInput
                label="Price per Unit"
                required
                placeholder="100"
                value={tier.pricePerUnit}
                onChange={(v) => {
                  const updated = [...(data.initialTiers || [])];
                  updated[idx] = { ...updated[idx], pricePerUnit: v };
                  updateField("initialTiers", updated);
                }}
              />
              <div className="space-y-1">
                <Label className="text-xs">
                  Units Available <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="10,000"
                  value={tier.unitsAvailable}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const updated = [...(data.initialTiers || [])];
                    updated[idx] = {
                      ...updated[idx],
                      unitsAvailable: raw ? Number(raw).toLocaleString("en-US") : "",
                    };
                    updateField("initialTiers", updated);
                  }}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
        <Info size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-500">
          Pricing tiers define unit-based pricing. Earlier tiers typically offer lower prices. You can add more tiers later from Fund Settings.
        </p>
      </div>
    </div>
  );
}
