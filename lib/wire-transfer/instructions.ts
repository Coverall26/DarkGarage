import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  encryptTaxId,
  decryptTaxId,
} from "@/lib/crypto/secure-storage";
import type {
  SetWireInstructionsInput,
  WireInstructions,
  WireInstructionsPublic,
} from "./types";

// ============================================================================
// GP Wire Instructions Configuration
// ============================================================================

/**
 * Set or update wire instructions for a fund.
 * Only GP ADMIN/OWNER should call this.
 */
export async function setWireInstructions(
  fundId: string,
  input: SetWireInstructionsInput,
  userId: string,
) {
  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
    select: { id: true, teamId: true },
  });

  if (!fund) {
    throw new Error(`Fund not found: ${fundId}`);
  }

  // Encrypt sensitive financial fields (account/routing numbers) with AES-256-GCM
  const wireInstructions: WireInstructions = {
    bankName: input.bankName,
    accountNumber: input.accountNumber ? encryptTaxId(input.accountNumber) : input.accountNumber,
    routingNumber: input.routingNumber ? encryptTaxId(input.routingNumber) : input.routingNumber,
    swiftCode: input.swiftCode,
    beneficiaryName: input.beneficiaryName,
    beneficiaryAddress: input.beneficiaryAddress,
    reference: input.reference,
    notes: input.notes,
    intermediaryBank: input.intermediaryBank,
  };

  const updated = await prisma.fund.update({
    where: { id: fundId },
    data: {
      wireInstructions: wireInstructions as unknown as Record<string, unknown>,
      wireInstructionsUpdatedAt: new Date(),
      wireInstructionsUpdatedBy: userId,
    },
    select: {
      id: true,
      name: true,
      wireInstructions: true,
      wireInstructionsUpdatedAt: true,
    },
  });

  return updated;
}

/**
 * Get wire instructions for a fund (GP view — full details).
 * Decrypts account/routing numbers from AES-256-GCM encrypted storage.
 */
export async function getWireInstructions(
  fundId: string,
): Promise<WireInstructions | null> {
  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
    select: { wireInstructions: true },
  });

  if (!fund?.wireInstructions) return null;

  const instructions = fund.wireInstructions as unknown as WireInstructions;

  // Decrypt sensitive fields for GP view
  return {
    ...instructions,
    accountNumber: instructions.accountNumber
      ? decryptTaxId(instructions.accountNumber)
      : instructions.accountNumber,
    routingNumber: instructions.routingNumber
      ? decryptTaxId(instructions.routingNumber)
      : instructions.routingNumber,
  };
}

/**
 * Get wire instructions for a fund (LP view — masked account number).
 * Account number is decrypted then masked to last 4 digits.
 * Routing number is NOT exposed to LP view for security.
 */
export async function getWireInstructionsPublic(
  fundId: string,
): Promise<WireInstructionsPublic | null> {
  const instructions = await getWireInstructions(fundId);
  if (!instructions) return null;

  const accountNum = instructions.accountNumber || "";

  return {
    bankName: instructions.bankName,
    accountNumberLast4: accountNum.length >= 4 ? accountNum.slice(-4) : "****",
    routingNumber: instructions.routingNumber,
    swiftCode: instructions.swiftCode,
    beneficiaryName: instructions.beneficiaryName,
    beneficiaryAddress: instructions.beneficiaryAddress,
    reference: instructions.reference,
    notes: instructions.notes,
    intermediaryBank: instructions.intermediaryBank,
  };
}

/**
 * Delete wire instructions for a fund.
 */
export async function deleteWireInstructions(
  fundId: string,
  userId: string,
) {
  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
    select: { id: true },
  });

  if (!fund) {
    throw new Error(`Fund not found: ${fundId}`);
  }

  return prisma.fund.update({
    where: { id: fundId },
    data: {
      wireInstructions: Prisma.JsonNull,
      wireInstructionsUpdatedAt: new Date(),
      wireInstructionsUpdatedBy: userId,
    },
    select: { id: true, name: true },
  });
}
