import { z } from "zod";

/**
 * Billing & Subscription Validation Schemas
 *
 * Additional billing schemas beyond those in admin.ts.
 * BillingCheckoutSchema, AiAddonSchema, BillingPortalSchema are in admin.ts.
 */

// ---------------------------------------------------------------------------
// PATCH /api/billing/cancel
// ---------------------------------------------------------------------------

export const CancelSubscriptionSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
  cancelImmediately: z.boolean().optional().default(false),
});

export type CancelSubscriptionInput = z.infer<typeof CancelSubscriptionSchema>;

// ---------------------------------------------------------------------------
// POST /api/billing/upgrade
// ---------------------------------------------------------------------------

export const UpgradeSchema = z.object({
  targetPlan: z.enum(["CRM_PRO", "FUNDROOM"]),
  interval: z.enum(["monthly", "yearly"]).optional().default("monthly"),
  prorationBehavior: z
    .enum(["create_prorations", "none", "always_invoice"])
    .optional()
    .default("create_prorations"),
});

export type UpgradeInput = z.infer<typeof UpgradeSchema>;

// ---------------------------------------------------------------------------
// POST /api/billing/cancellation-feedback
// ---------------------------------------------------------------------------

export const CancellationFeedbackSchema = z.object({
  reason: z.enum([
    "TOO_EXPENSIVE",
    "MISSING_FEATURES",
    "SWITCHED_TO_COMPETITOR",
    "NOT_USING_ENOUGH",
    "TOO_COMPLEX",
    "OTHER",
  ]),
  details: z.string().max(5000).optional().nullable(),
  willReturn: z.boolean().optional(),
});

export type CancellationFeedbackInput = z.infer<typeof CancellationFeedbackSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/billing/manage
// ---------------------------------------------------------------------------

export const BillingManageSchema = z.object({
  priceId: z.string().min(1).max(255),
  upgradePlan: z.boolean(),
  quantity: z.number().int().positive().max(10000).optional(),
  addSeat: z.boolean().optional(),
  proAnnualBanner: z.boolean().optional(),
  return_url: z.string().url().max(500).optional(),
  type: z
    .enum(["manage", "invoices", "subscription_update", "payment_method_update"])
    .optional()
    .default("manage"),
});

export type BillingManageInput = z.infer<typeof BillingManageSchema>;
