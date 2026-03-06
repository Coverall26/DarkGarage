import { get } from "@vercel/edge-config";
import { logger } from "@/lib/logger";

export const isBlacklistedEmail = async (email: string) => {
  if (!process.env.EDGE_CONFIG) {
    return false;
  }

  let blacklistedEmails: string[] = [];
  try {
    const result = await get("emails");
    blacklistedEmails = Array.isArray(result)
      ? result.filter((item): item is string => typeof item === "string")
      : [];
  } catch (e) {
    logger.error("Failed to fetch blacklisted emails from edge config", { module: "edge-config-blacklist", error: String(e) });
  }

  if (blacklistedEmails.length === 0) return false;
  return new RegExp(blacklistedEmails.join("|"), "i").test(email);
};
