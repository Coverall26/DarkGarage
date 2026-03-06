// MIGRATION STATUS: CRITICAL
// App Router equivalent: none — Phase 2 priority
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import { SignatureDocumentCreateSchema, SignatureDocumentCreateInput } from "@/lib/validations/teams";
import { DocumentStorageType, SignatureRecipientRole } from "@prisma/client";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { teamId } = req.query as { teamId: string };

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      teamId,
      userId: session.user.id,
    },
  });

  if (!userTeam) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    return handleGet(req, res, teamId);
  } else if (req.method === "POST") {
    return handlePost(req, res, teamId, session.user.id);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId: string
) {
  try {
    const { status, page = "1", limit = "10" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { teamId };
    if (status) {
      where.status = status;
    }

    const [documents, total] = await Promise.all([
      prisma.signatureDocument.findMany({
        where,
        include: {
          recipients: {
            orderBy: { signingOrder: "asc" },
          },
          _count: {
            select: {
              recipients: true,
              fields: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.signatureDocument.count({ where }),
    ]);

    return res.status(200).json({
      documents,
      pagination: {
        total,
        pages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error fetching signature documents", { module: "teams", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId: string,
  userId: string
) {
  try {
    const parsed = validateBodyPagesRouter(req.body, SignatureDocumentCreateSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
    }
    const {
      title,
      description,
      file,
      storageType = "S3_PATH",
      emailSubject,
      emailMessage,
      recipients = [],
      status = "DRAFT",
      expirationDate,
      fundId,
      documentType,
      requiredForOnboarding,
    } = parsed.data;

    const document = await prisma.signatureDocument.create({
      data: {
        title,
        description,
        file,
        storageType: storageType as DocumentStorageType,
        emailSubject,
        emailMessage,
        status: status as "DRAFT" | "SENT",
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        teamId,
        createdById: userId,
        fundId: fundId || null,
        documentType: documentType || null,
        requiredForOnboarding: requiredForOnboarding === true,
        recipients: {
          create: recipients.map((r: NonNullable<SignatureDocumentCreateInput["recipients"]>[number], index: number) => ({
            name: r.name!,
            email: r.email!,
            role: (r.role || "SIGNER") as SignatureRecipientRole,
            signingOrder: r.signingOrder || index + 1,
            status: "PENDING" as const,
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    // Fire-and-forget: Record e-sig document creation for tier enforcement
    import("@/lib/esig/usage-service").then(({ recordDocumentCreated }) =>
      recordDocumentCreated(teamId)
    ).catch((e) => reportError(e as Error));

    return res.status(201).json(document);
  } catch (error) {
    reportError(error as Error);
    logger.error("Error creating signature document", { module: "teams", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}
