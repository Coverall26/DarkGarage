// MIGRATION STATUS: CRITICAL
// App Router equivalent: none (Phase 2 migration target)
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { handleRoute } from "@/ee/features/conversations/api/team-conversations-route";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return handleRoute(req, res);
}
