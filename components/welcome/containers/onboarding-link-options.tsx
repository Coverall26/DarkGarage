import { useState } from "react";

import { PlanEnum } from "@/ee/stripe/constants";
import { LinkAudienceType, LinkType } from "@prisma/client";
import { LinkPreset } from "@prisma/client";

import { usePlan } from "@/lib/swr/use-billing";
import useLimits from "@/lib/swr/use-limits";

import { UpgradePlanModal } from "@/components/billing/upgrade-plan-modal";
import { DEFAULT_LINK_TYPE } from "@/components/links/link-sheet";
import {
  AgreementSection,
  AllowDownloadSection,
  AllowListSection,
  AllowNotificationSection,
  ConversationSection,
  CustomFieldsSection,
  DenyListSection,
  EmailAuthenticationSection,
  EmailProtectionSection,
  ExpirationSection,
  FeedbackSection,
  OGSection,
  PasswordSection,
  ProBannerSection,
  QuestionSection,
  ScreenshotProtectionSection,
  UploadSection,
  WatermarkSection,
} from "@/components/links/link-sheet/sections";
import { ChevronDown } from "@/components/shared/icons";

export type LinkUpgradeOptions = {
  state: boolean;
  trigger: string;
  plan?: "Pro" | "Business" | "Data Rooms" | "Data Rooms Plus";
  highlightItem?: string[];
};

export const OnboardingLinkOptions = ({
  data,
  setData,
  targetId,
  linkType,
  editLink,
  currentPreset = null,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
  targetId?: string;
  linkType: LinkType;
  editLink?: boolean;
  currentPreset?: LinkPreset | null;
}) => {
  const {
    isStarter,
    isPro,
    isBusiness,
    isDatarooms,
    isDataroomsPlus,
    isTrial,
  } = usePlan();
  const { limits } = useLimits();
  const allowAdvancedLinkControls = limits
    ? limits?.advancedLinkControlsOnPro
    : false;
  const allowWatermarkOnBusiness = limits?.watermarkOnBusiness ?? false;

  const [openUpgradeModal, setOpenUpgradeModal] = useState<boolean>(false);
  const [trigger, setTrigger] = useState<string>("");
  const [upgradePlan, setUpgradePlan] = useState<PlanEnum>(PlanEnum.Business);
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const [highlightItem, setHighlightItem] = useState<string[]>([]);

  const handleUpgradeStateChange = ({
    state,
    trigger,
    plan,
    highlightItem,
  }: LinkUpgradeOptions) => {
    setOpenUpgradeModal(state);
    setTrigger(trigger);
    if (plan) {
      setUpgradePlan(plan as PlanEnum);
    }
    setHighlightItem(highlightItem || []);
  };

  // Basic settings that are always shown
  const basicSettings = (
    <>
      <EmailProtectionSection {...{ data, setData }} />
      <AllowNotificationSection {...{ data, setData }} />
      <AllowDownloadSection {...{ data, setData }} />
      <ExpirationSection {...{ data, setData }} presets={currentPreset} />
      <PasswordSection {...{ data, setData }} />
      {/* Advanced toggle for documents only */}
      {linkType === LinkType.DOCUMENT_LINK && (
        <div className="mb-4 mt-2">
          <button
            type="button"
            className="group flex w-full items-center justify-between text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowAdvancedSettings((v) => !v)}
            aria-expanded={showAdvancedSettings}
          >
            <span className="text-sm font-semibold text-gray-900">
              Advanced settings
            </span>
            <span
              className={`transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`}
            >
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}
    </>
  );

  // Advanced settings that are shown only when showAdvancedSettings is true
  const advancedSettings = (
    <>
      {limits?.dataroomUpload &&
      linkType === LinkType.DATAROOM_LINK &&
      targetId ? (
        <UploadSection
          {...{ data, setData }}
          isAllowed={isTrial || isDatarooms || isDataroomsPlus}
          handleUpgradeStateChange={handleUpgradeStateChange}
          targetId={targetId}
        />
      ) : null}
      <OGSection
        {...{ data, setData }}
        isAllowed={
          isTrial ||
          (isPro && allowAdvancedLinkControls) ||
          isBusiness ||
          isDatarooms ||
          isDataroomsPlus
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
        editLink={editLink ?? false}
        presets={currentPreset}
      />
      <EmailAuthenticationSection
        {...{ data, setData }}
        isAllowed={
          isTrial ||
          (isPro && allowAdvancedLinkControls) ||
          isBusiness ||
          isDatarooms ||
          isDataroomsPlus
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      {data.audienceType === LinkAudienceType.GENERAL ? (
        <AllowListSection
          {...{ data, setData }}
          isAllowed={
            isTrial ||
            (isPro && allowAdvancedLinkControls) ||
            isBusiness ||
            isDatarooms ||
            isDataroomsPlus
          }
          handleUpgradeStateChange={handleUpgradeStateChange}
          presets={currentPreset}
        />
      ) : null}
      {data.audienceType === LinkAudienceType.GENERAL ? (
        <DenyListSection
          {...{ data, setData }}
          isAllowed={
            isTrial ||
            (isPro && allowAdvancedLinkControls) ||
            isBusiness ||
            isDatarooms ||
            isDataroomsPlus
          }
          handleUpgradeStateChange={handleUpgradeStateChange}
          presets={currentPreset}
        />
      ) : null}
      <ScreenshotProtectionSection
        {...{ data, setData }}
        isAllowed={
          isTrial ||
          (isPro && allowAdvancedLinkControls) ||
          isBusiness ||
          isDatarooms ||
          isDataroomsPlus
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      <WatermarkSection
        {...{ data, setData }}
        isAllowed={
          isTrial || isDatarooms || isDataroomsPlus || allowWatermarkOnBusiness
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
        presets={currentPreset}
      />
      <AgreementSection
        {...{ data, setData }}
        isAllowed={
          isTrial || isDatarooms || isDataroomsPlus || allowWatermarkOnBusiness
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      {linkType === LinkType.DATAROOM_LINK &&
      limits?.conversationsInDataroom ? (
        <ConversationSection
          {...{ data, setData }}
          isAllowed={
            isDataroomsPlus ||
            ((isBusiness || isDatarooms) && limits?.conversationsInDataroom)
          }
          handleUpgradeStateChange={handleUpgradeStateChange}
        />
      ) : null}
      {linkType === LinkType.DOCUMENT_LINK ? (
        <>
          <FeedbackSection {...{ data, setData }} />
          <QuestionSection
            {...{ data, setData }}
            isAllowed={
              isTrial ||
              (isPro && allowAdvancedLinkControls) ||
              isBusiness ||
              isDatarooms ||
              isDataroomsPlus
            }
            handleUpgradeStateChange={handleUpgradeStateChange}
          />
        </>
      ) : null}
      <CustomFieldsSection
        {...{ data, setData }}
        isAllowed={isTrial || isBusiness || isDatarooms || isDataroomsPlus}
        handleUpgradeStateChange={handleUpgradeStateChange}
        presets={currentPreset}
      />
      {linkType === LinkType.DOCUMENT_LINK ? (
        <ProBannerSection
          {...{ data, setData }}
          isAllowed={
            isTrial ||
            isPro ||
            isBusiness ||
            isDatarooms ||
            isDataroomsPlus ||
            isStarter
          }
          handleUpgradeStateChange={handleUpgradeStateChange}
        />
      ) : null}
    </>
  );

  return (
    <div>
      {basicSettings}
      {showAdvancedSettings && advancedSettings}
      <UpgradePlanModal
        clickedPlan={upgradePlan}
        open={openUpgradeModal}
        setOpen={setOpenUpgradeModal}
        trigger={trigger}
        highlightItem={highlightItem}
      />
    </div>
  );
};
