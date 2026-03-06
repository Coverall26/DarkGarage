// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { errorhandler } from "@/lib/errorHandler";

import { authOptions } from "@/lib/auth/auth-options";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import { PushSubscribeSchema, PushUnsubscribeSchema } from "@/lib/validations/teams";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "POST") {
    try {
      const parsed = validateBodyPagesRouter(req.body, PushSubscribeSchema);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
      }
      const { endpoint, p256dh, auth, userAgent } = parsed.data;

      const subscription = await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: {
          p256dh,
          auth,
          userAgent,
          userId,
        },
        create: {
          endpoint,
          p256dh,
          auth,
          userAgent,
          userId,
        },
      });

      return res.status(200).json({ success: true, id: subscription.id });
    } catch (error) {
      errorhandler(error, res);
    }
  } else if (req.method === "DELETE") {
    try {
      const parsed = validateBodyPagesRouter(req.body, PushUnsubscribeSchema);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
      }
      const { endpoint } = parsed.data;

      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          userId,
        },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      errorhandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["POST", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
