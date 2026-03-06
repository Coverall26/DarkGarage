// MIGRATION STATUS: DEPRECATED
// App Router equivalent: app/api/billing/checkout/route.ts
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { sendEmail } from "@/lib/resend";
import { randomBytes } from "crypto";
import { z } from "zod";
import SignatureRequestEmail from "@/components/emails/signature-request";
import { strictRateLimiter } from "@/lib/security/rate-limiter";
import { logger } from "@/lib/logger";

const CreateSubscriptionSchema = z.object({
  investorId: z.string().min(1, "Investor ID is required"),
  fundId: z.string().optional(),
  amount: z.union([z.number(), z.string()]).transform((val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) throw new Error("Amount must be positive");
    if (num > 100e9) throw new Error("Amount exceeds maximum");
    return num;
  }),
  file: z.string().min(1, "File is required"),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  emailSubject: z.string().max(500).optional(),
  emailMessage: z.string().max(5000).optional(),
  teamId: z.string().min(1, "Team ID is required"),
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const allowed = await strictRateLimiter(req, res);
  if (!allowed) return;

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = CreateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid request body",
      });
    }

    const {
      investorId,
      fundId,
      amount,
      file,
      title,
      description,
      emailSubject,
      emailMessage,
      teamId,
    } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        teams: {
          where: { teamId },
          include: { team: true },
        },
      },
    });

    if (!user?.teams?.[0]) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const team = user.teams[0].team;
    const role = user.teams[0].role;
    if (!["ADMIN", "OWNER", "SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: { user: true },
    });

    if (!investor) {
      return res.status(404).json({ error: "Investor not found" });
    }

    const signingToken = randomBytes(32).toString("hex");

    const document = await prisma.signatureDocument.create({
      data: {
        title: title || `Subscription Agreement - ${investor.entityName || investor.user?.name || "Investor"}`,
        description: description || `Subscription amount: $${amount.toLocaleString()}`,
        file,
        storageType: "S3_PATH",
        status: "SENT",
        sentAt: new Date(),
        emailSubject: emailSubject || "Action Required: Sign Your Subscription Agreement",
        emailMessage: emailMessage || `Please review and sign your subscription agreement for $${amount.toLocaleString()}.`,
        documentType: "SUBSCRIPTION",
        subscriptionAmount: amount,
        investorId,
        metadata: {
          fundId: fundId || null,
          createdByEmail: session.user.email,
          subscriptionAmount: amount,
        },
        teamId,
        createdById: user.id,
        recipients: {
          create: {
            name: investor.entityName || investor.user?.name || "Investor",
            email: investor.user?.email || "",
            role: "SIGNER",
            signingOrder: 1,
            status: "PENDING",
            signingToken,
          },
        },
      },
      include: {
        recipients: true,
      },
    });

    await prisma.subscription.create({
      data: {
        investorId,
        fundId: fundId || null,
        signatureDocumentId: document.id,
        amount,
        status: "PENDING",
      },
    });

    const signingUrl = `${process.env.NEXTAUTH_URL}/view/sign/${signingToken}`;

    if (investor.user?.email) {
      try {
        await sendEmail({
          to: investor.user.email,
          subject: document.emailSubject || "Sign Your Subscription Agreement",
          react: SignatureRequestEmail({
            recipientName: investor.entityName || investor.user.name || "Investor",
            documentTitle: document.title,
            senderName: "FundRoom",
            teamName: team.name,
            message: `Subscription Amount: $${amount.toLocaleString()}`,
            signingUrl: signingUrl,
          }),
        });
      } catch (emailError) {
        logger.error("Error sending signature email", { module: "subscriptions", metadata: { error: (emailError as Error).message } });
      }
    }

    return res.status(201).json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        subscriptionAmount: document.subscriptionAmount?.toString(),
        signingUrl,
      },
    });
  } catch (error) {
    logger.error("Error creating subscription document", { module: "subscriptions", metadata: { error: (error as Error).message } });
    reportError(error, { path: "/api/subscriptions/create", action: "create-subscription" });
    return res.status(500).json({ error: "Failed to create subscription" });
  }
}
