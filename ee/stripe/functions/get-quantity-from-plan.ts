import { getPlanFromPriceId } from "../utils";
import { logger } from "@/lib/logger";

export function getQuantityFromPriceId(priceId?: string) {
  if (!priceId) {
    return 1;
  }
  try {
    const plan = getPlanFromPriceId(priceId);
    return plan?.minQuantity ?? 1;
  } catch (error) {
    logger.error("Error getting quantity for priceId", { module: "stripe", metadata: { priceId, error: (error as Error).message } });
    return 1;
  }
}
