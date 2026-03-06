import { openai } from "@/ee/features/ai/lib/models/openai";
import { logger } from "@/lib/logger";

/**
 * Delete a vector store
 * @param vectorStoreId - The vector store ID to delete
 */
export async function deleteVectorStore(vectorStoreId: string): Promise<void> {
  try {
    await openai.vectorStores.delete(vectorStoreId);
  } catch (error) {
    logger.error("Error deleting vector store", { module: "ai", metadata: { error: (error as Error).message } });
    throw new Error("Failed to delete vector store");
  }
}
