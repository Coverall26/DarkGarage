import { useEffect, useMemo, useState } from "react";

import { Agreement, LinkPreset } from "@prisma/client";
import { motion } from "motion/react";
import { FileSignature } from "lucide-react";

import { FADE_IN_ANIMATION_SETTINGS } from "@/lib/constants";
import { useAgreements } from "@/lib/swr/use-agreements";
import { useTeam } from "@/context/team-context";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { DEFAULT_LINK_TYPE } from ".";
import AgreementSheet from "./agreement-panel";
import LinkItem from "./link-item";
import { LinkUpgradeOptions } from "./link-options";

type NdaMode = "checkbox" | "signsuite";

export default function AgreementSection({
  data,
  setData,
  isAllowed,
  handleUpgradeStateChange,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
  isAllowed: boolean;
  handleUpgradeStateChange: ({
    state,
    trigger,
    plan,
    highlightItem,
  }: LinkUpgradeOptions) => void;
}) {
  const { agreements } = useAgreements();
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;

  const {
    enableAgreement,
    agreementId,
    enableSignSuiteNda,
    signSuiteNdaDocumentId,
    emailProtected,
  } = data;

  // Determine if any NDA is enabled and which mode
  const anyNdaEnabled = enableAgreement || enableSignSuiteNda;
  const [enabled, setEnabled] = useState<boolean>(false);
  const [ndaMode, setNdaMode] = useState<NdaMode>(
    enableSignSuiteNda ? "signsuite" : "checkbox",
  );
  const [isAgreementSheetVisible, setIsAgreementSheetVisible] =
    useState<boolean>(false);

  // Fetch signature documents for SignSuite NDA template selector
  const { data: sigDocsData } = useSWR<{
    documents: Array<{ id: string; title: string; status: string }>;
  }>(
    teamId && enabled && ndaMode === "signsuite"
      ? `/api/teams/${teamId}/signature-documents?limit=50`
      : null,
    fetcher,
    { dedupingInterval: 30000 },
  );

  const signatureDocuments = sigDocsData?.documents || [];

  const filteredAgreements = useMemo(
    () =>
      agreements.filter(
        (agreement: Agreement) =>
          !agreement.deletedAt || agreement.id === agreementId,
      ),
    [agreements, agreementId],
  );

  useEffect(() => {
    setEnabled(enableAgreement || enableSignSuiteNda || false);
    if (enableSignSuiteNda) {
      setNdaMode("signsuite");
    } else {
      setNdaMode("checkbox");
    }
  }, [enableAgreement, enableSignSuiteNda]);

  const handleToggle = async () => {
    const updatedEnabled = !enabled;

    if (updatedEnabled) {
      // Turning on — default to checkbox mode
      setData({
        ...data,
        enableAgreement: true,
        enableSignSuiteNda: false,
        signSuiteNdaDocumentId: null,
        emailProtected: true,
      });
      setNdaMode("checkbox");
    } else {
      // Turning off — disable both modes
      setData({
        ...data,
        enableAgreement: false,
        agreementId: null,
        enableSignSuiteNda: false,
        signSuiteNdaDocumentId: null,
      });
    }
    setEnabled(updatedEnabled);
  };

  const handleModeChange = (mode: NdaMode) => {
    setNdaMode(mode);
    if (mode === "checkbox") {
      setData({
        ...data,
        enableAgreement: true,
        enableSignSuiteNda: false,
        signSuiteNdaDocumentId: null,
        emailProtected: true,
      });
    } else {
      setData({
        ...data,
        enableAgreement: false,
        agreementId: null,
        enableSignSuiteNda: true,
        emailProtected: true,
      });
    }
  };

  const handleAgreementChange = (value: string) => {
    if (value === "add_agreement") {
      setIsAgreementSheetVisible(true);
      return;
    }
    setData({ ...data, agreementId: value });
  };

  const handleSignSuiteDocChange = (value: string) => {
    setData({ ...data, signSuiteNdaDocumentId: value });
  };

  return (
    <div className="pb-5">
      <LinkItem
        title="Require NDA to view"
        link="https://www.fundroom.ai/help/require-nda"
        tooltipContent="Require visitors to sign or acknowledge an NDA before accessing content."
        enabled={enabled}
        action={handleToggle}
        isAllowed={isAllowed}
        requiredPlan="datarooms"
        upgradeAction={() =>
          handleUpgradeStateChange({
            state: true,
            trigger: "link_sheet_agreement_section",
            plan: "Data Rooms",
            highlightItem: ["nda"],
          })
        }
      />

      {enabled && (
        <motion.div
          className="relative mt-4 space-y-3"
          {...FADE_IN_ANIMATION_SETTINGS}
        >
          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleModeChange("checkbox")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                ndaMode === "checkbox"
                  ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                  : "border-border bg-background text-muted-foreground hover:border-[#0066FF]/50"
              }`}
            >
              Checkbox NDA
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("signsuite")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                ndaMode === "signsuite"
                  ? "border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]"
                  : "border-border bg-background text-muted-foreground hover:border-[#0066FF]/50"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <FileSignature className="h-3.5 w-3.5" />
                SignSuite NDA
              </span>
            </button>
          </div>

          {ndaMode === "checkbox" ? (
            /* Checkbox NDA — select agreement */
            <div className="flex w-full flex-col items-start gap-6 overflow-x-visible pb-4 pt-0">
              <div className="w-full space-y-2">
                <Select
                  onValueChange={handleAgreementChange}
                  defaultValue={agreementId ?? ""}
                >
                  <SelectTrigger className="focus:ring-offset-3 flex w-full rounded-md border-0 bg-background py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-input placeholder:text-muted-foreground focus:ring-2 focus:ring-gray-400 sm:text-sm sm:leading-6">
                    <SelectValue placeholder="Select an agreement" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAgreements &&
                      filteredAgreements.map(({ id, name }) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                    <SelectItem key="add_agreement" value="add_agreement">
                      Add new agreement
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            /* SignSuite NDA — select signature document template */
            <div className="flex w-full flex-col items-start gap-4 overflow-x-visible pb-4 pt-0">
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[#0066FF]/30 bg-[#0066FF]/5 text-[#0066FF]"
                  >
                    <FileSignature className="mr-1 h-3 w-3" />
                    E-Signature Required
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Visitors must electronically sign an NDA before viewing. The
                  signed document is auto-filed to DataRoom.
                </p>
                <Select
                  onValueChange={handleSignSuiteDocChange}
                  defaultValue={signSuiteNdaDocumentId ?? ""}
                >
                  <SelectTrigger className="focus:ring-offset-3 flex w-full rounded-md border-0 bg-background py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-input placeholder:text-muted-foreground focus:ring-2 focus:ring-gray-400 sm:text-sm sm:leading-6">
                    <SelectValue placeholder="Select NDA template" />
                  </SelectTrigger>
                  <SelectContent>
                    {signatureDocuments.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.title}
                      </SelectItem>
                    ))}
                    {signatureDocuments.length === 0 && (
                      <SelectItem value="_none" disabled>
                        No signature documents found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <AgreementSheet
        isOpen={isAgreementSheetVisible}
        setIsOpen={setIsAgreementSheetVisible}
      />
    </div>
  );
}
