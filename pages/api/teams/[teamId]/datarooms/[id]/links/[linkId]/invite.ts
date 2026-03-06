// MIGRATION STATUS: CRITICAL
// App Router equivalent: none (Phase 2 migration target)
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import handleRoute from "@/ee/features/dataroom-invitations/api/link-invite";

export const config = {
  maxDuration: 300,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return handleRoute(req, res);
}
