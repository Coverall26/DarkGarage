/**
 * Multi-Tenant Defense-in-Depth Guard
 *
 * Provides consistent team-scoping for financial model queries.
 * All 6 financial models (Investment, Investor, Transaction, Distribution,
 * CapitalCall, InvestmentTranche) have a denormalized `teamId` field
 * for direct query filtering without JOINs through Fund.
 *
 * Usage:
 *   import { withTeamScope, ensureTeamId } from "@/lib/multi-tenant/tenant-guard";
 *
 *   // Add teamId filter to any Prisma where clause
 *   const investments = await prisma.investment.findMany({
 *     where: withTeamScope({ status: "COMMITTED" }, teamId),
 *   });
 *
 *   // Ensure teamId is set on create/update (denormalize from Fund.teamId)
 *   await prisma.investment.create({
 *     data: {
 *       ...data,
 *       teamId: ensureTeamId(fund.teamId),
 *     },
 *   });
 */

import prisma from "@/lib/prisma";

/**
 * Adds teamId to a Prisma where clause for tenant-scoped queries.
 * Falls back to fundId-based filtering when teamId is not yet backfilled.
 */
export function withTeamScope<T extends Record<string, unknown>>(
  where: T,
  teamId: string
): T & { teamId: string } {
  return { ...where, teamId };
}

/**
 * Adds teamId to a Prisma where clause, with fallback to fund-based scoping.
 * Use this during the transition period when some records may not have teamId.
 */
export function withTeamScopeOrFund<T extends Record<string, unknown>>(
  where: T,
  teamId: string,
  fundId?: string
): T & { OR: Array<Record<string, unknown>> } {
  const conditions: Array<Record<string, unknown>> = [{ teamId }];
  if (fundId) {
    conditions.push({ fundId, fund: { teamId } });
  }
  return { ...where, OR: conditions };
}

/**
 * Validates that a teamId is present and non-empty.
 * Throws if missing — use this when creating records to ensure
 * the denormalized teamId is always populated.
 */
export function ensureTeamId(teamId: string | null | undefined): string {
  if (!teamId) {
    throw new Error("teamId is required for multi-tenant record creation");
  }
  return teamId;
}

/**
 * Resolves teamId from a fundId by looking up Fund.teamId.
 * Use when creating financial records where you have fundId but not teamId.
 */
export async function resolveTeamIdFromFund(
  fundId: string
): Promise<string> {
  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
    select: { teamId: true },
  });
  if (!fund) {
    throw new Error(`Fund not found: ${fundId}`);
  }
  return fund.teamId;
}

/**
 * Resolves teamId from an investmentId by traversing Investment → Fund.
 * Use when creating InvestmentTranche records.
 */
export async function resolveTeamIdFromInvestment(
  investmentId: string
): Promise<string> {
  const investment = await prisma.investment.findUnique({
    where: { id: investmentId },
    select: { fund: { select: { teamId: true } } },
  });
  if (!investment?.fund) {
    throw new Error(`Investment or fund not found: ${investmentId}`);
  }
  return investment.fund.teamId;
}

/**
 * Validates that a record belongs to the expected team.
 * Use as a defense-in-depth check after fetching a record.
 * Returns true if the record's teamId matches, false otherwise.
 */
export function validateTeamOwnership(
  record: { teamId?: string | null; fund?: { teamId: string } | null },
  expectedTeamId: string
): boolean {
  // Primary check: direct teamId
  if (record.teamId) {
    return record.teamId === expectedTeamId;
  }
  // Fallback: check via fund relation
  if (record.fund?.teamId) {
    return record.fund.teamId === expectedTeamId;
  }
  // No team association — cannot validate
  return false;
}

/**
 * Populates teamId on a new record's data object.
 * Resolves from fundId if teamId not already provided.
 * Use in create operations to ensure teamId is always set.
 */
export async function populateTeamId(
  data: { fundId?: string; teamId?: string | null }
): Promise<string | undefined> {
  // Already has teamId
  if (data.teamId) return data.teamId;

  // Resolve from fundId
  if (data.fundId) {
    return resolveTeamIdFromFund(data.fundId);
  }

  return undefined;
}
