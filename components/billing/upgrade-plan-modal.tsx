/**
 * PHASE 2 STUB — UpgradePlanModal
 *
 * Currently a passthrough wrapper (renders only children).
 * Phase 2 will replace this with a full upgrade modal that:
 *   - Shows plan comparison (FREE → CRM_PRO → BUSINESS → FUNDROOM)
 *   - Integrates with Stripe Checkout via /api/billing/checkout
 *   - Displays feature diff between current and target tier
 *
 * Active production billing UI lives in:
 *   app/admin/settings/sections/billing-crm.tsx  (plan cards, AI add-on, usage meters)
 *   app/api/billing/checkout/route.ts             (Stripe Checkout session creation)
 *   app/api/billing/portal/route.ts               (Stripe Billing Portal)
 *
 * 25 files import this component — do not delete until Phase 2 replacement ships.
 */
import React from "react";

import { PlanEnum } from "@/ee/stripe/constants";

export function UpgradePlanModal({
  clickedPlan,
  trigger,
  open,
  setOpen,
  highlightItem,
  children,
}: {
  clickedPlan: PlanEnum;
  trigger?: string;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  highlightItem?: string[];
  children?: React.ReactNode;
}) {
  return <>{children}</>;
}
