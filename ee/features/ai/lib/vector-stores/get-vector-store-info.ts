import { openai } from "@/ee/features/ai/lib/models/openai";
import { type OpenAI } from "openai";
import { logger } from "@/lib/logger";

/**
 * Get information about a vector store
 * @param vectorStoreId - The vector store ID
 * @returns Vector store information
 */
export async function getVectorStoreInfo(
  vectorStoreId: string,
): Promise<OpenAI.VectorStores.VectorStore> {
  try {
    const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
    return vectorStore;
  } catch (error) {
    logger.error("Error getting vector store info", { module: "ai", metadata: { error: (error as Error).message } });
    throw new Error("Failed to get vector store info");
  }
}
