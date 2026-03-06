/**
 * Validation Schemas — Barrel Export
 *
 * Central re-export of all domain-specific Zod schemas.
 * Import from "@/lib/validations" for convenience.
 *
 * Organization:
 *   admin.ts          — Fund CRUD, capital calls, tranches, pricing, settings
 *   auth.ts           — Login, registration, MFA, admin setup
 *   billing.ts        — CRM billing, Stripe checkout, subscriptions
 *   esign-outreach.ts — Envelopes, outreach, marketplace deals, offerings
 *   fund.ts           — Funding rounds, manual investments
 *   investment.ts     — Commitments, staged commitments, common fields
 *   lp.ts             — LP registration, NDA, accreditation, onboarding
 *   teams.ts          — Teams, documents, datarooms, links, CRM contacts
 *   wire.ts           — Wire proof upload, GP wire confirmation
 */

export * from "./admin";
export * from "./auth";
export * from "./billing";
export * from "./esign-outreach";
export * from "./fund";
export * from "./investment";
export * from "./lp";
export * from "./teams";
export * from "./wire";
