import { openai } from "@/ee/features/ai/lib/models/openai";
import { logger } from "@/lib/logger";

/**
 * Create a vector store for a team
 * @param teamId - The team ID
 * @param name - The team name
 * @returns The vector store ID
 */
export async function createTeamVectorStore(
  teamId: string,
  name: string,
): Promise<string> {
  try {
    const vectorStore = await openai.vectorStores.create({
      name: `Team: ${name}`,
      metadata: {
        teamId,
        type: "team",
      },
    });

    return vectorStore.id;
  } catch (error) {
    logger.error("Error creating team vector store", { module: "ai", metadata: { error: (error as Error).message } });
    throw new Error("Failed to create team vector store");
  }
}
