import { PrismaClient } from "@prisma/client";

import { isBackupDbEnabled } from "@/lib/feature-flags";

let backupPrisma: PrismaClient | null = null;

export function isBackupEnabled(): boolean {
  return isBackupDbEnabled() && !!process.env.REPLIT_DATABASE_URL;
}

export function getBackupPrismaClient(): PrismaClient | null {
  if (!isBackupEnabled()) return null;

  if (!backupPrisma) {
    backupPrisma = new PrismaClient({
      datasourceUrl: process.env.REPLIT_DATABASE_URL,
      log: ["error"],
    });
  }
  return backupPrisma;
}

export async function disconnectBackup(): Promise<void> {
  if (backupPrisma) {
    await backupPrisma.$disconnect();
    backupPrisma = null;
  }
}
