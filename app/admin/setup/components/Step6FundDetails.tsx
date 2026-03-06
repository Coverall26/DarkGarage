"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { WizardData } from "../hooks/useWizardState";
import { FUND_TYPE_DEFAULTS, type FundSubType } from "@/lib/validations/fund-types";

import type { Step6Props } from "./step6-types";
import { GPFundSection } from "./step6-gp-fund-section";
import { StartupSection } from "./step6-startup-section";
import { SECComplianceSection } from "./step6-sec-compliance";
import { FundingStructureSection } from "./step6-funding-structure";
import { WireSection } from "./step6-wire-section";

export default function Step6FundDetails({ data, updateField }: Step6Props) {
  const [showAcct, setShowAcct] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(data.marketplaceInterest);
  const [showFundingStructure, setShowFundingStructure] = useState(
    (data.plannedRounds?.length > 0 || data.initialTiers?.length > 0),
  );

  const isGPFund = data.raiseMode === "GP_FUND";
  const isStartup = data.raiseMode === "STARTUP";

  const handleFundTypeSelect = useCallback(
    (type: string) => {
      updateField("fundSubType", type);
      const defaults = FUND_TYPE_DEFAULTS[type as FundSubType];
      if (defaults && type !== "CUSTOM") {
        updateField("mgmtFee", String(defaults.managementFeePct));
        updateField("carry", String(defaults.carryPct));
        if (defaults.termYears !== null) updateField("fundTerm", String(defaults.termYears));
        if (defaults.extensionYears !== null) updateField("extensionYears", String(defaults.extensionYears));
        if (defaults.hurdleRate !== null) updateField("hurdle", String(defaults.hurdleRate));
        if (defaults.waterfallType) updateField("waterfallType", defaults.waterfallType);
        updateField("highWaterMark", defaults.highWaterMark);
        toast.info(`Defaults applied for ${type.replace(/_/g, " ").toLowerCase()}`);
      }
    },
    [updateField],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {isStartup ? "Raise Configuration" : "Fund Details"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isStartup
            ? "Configure your startup raise instrument and terms."
            : "Configure your fund economics and wire instructions."}
        </p>
        <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Configure free &bull; Activate paid
        </span>
      </div>

      {/* GP FUND MODE */}
      {isGPFund && (
        <GPFundSection
          data={data}
          updateField={updateField}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          showMarketplace={showMarketplace}
          setShowMarketplace={setShowMarketplace}
          handleFundTypeSelect={handleFundTypeSelect}
        />
      )}

      {/* STARTUP MODE */}
      {isStartup && (
        <StartupSection data={data} updateField={updateField} />
      )}

      {/* SEC / Investment Company Act (GP Fund only) */}
      {isGPFund && (
        <SECComplianceSection data={data} updateField={updateField} />
      )}

      {/* Funding Structure (Both Modes) */}
      <FundingStructureSection
        data={data}
        updateField={updateField}
        isStartup={isStartup}
        isGPFund={isGPFund}
        showFundingStructure={showFundingStructure}
        setShowFundingStructure={setShowFundingStructure}
      />

      {/* Wire Instructions (Both Modes) */}
      <WireSection
        data={data}
        updateField={updateField}
        showAcct={showAcct}
        setShowAcct={setShowAcct}
        showRouting={showRouting}
        setShowRouting={setShowRouting}
      />
    </div>
  );
}
