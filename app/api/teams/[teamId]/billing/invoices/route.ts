import { NextRequest, NextResponse } from "next/server";

import { stripeInstance } from "@/ee/stripe";
import { getServerSession } from "next-auth";
import Stripe from "stripe";

import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { CustomUser } from "@/lib/types";

export const dynamic = "force-dynamic";

function isOldAccount(plan: string) {
  return plan.includes("+old");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await params;
  const userId = (session.user as CustomUser).id;

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        stripeId: true,
        plan: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (!team.stripeId) {
      return NextResponse.json({ invoices: [] });
    }

    const stripe = stripeInstance(isOldAccount(team.plan));
    const invoices = await stripe.invoices.list({
      customer: team.stripeId,
      limit: 100,
    });

    const transformedInvoices = invoices.data.map((invoice: Stripe.Invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      created: invoice.created,
      invoicePdf: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      description: invoice.lines.data[0]?.description || "Subscription",
    }));

    return NextResponse.json({ invoices: transformedInvoices });
  } catch (error) {
    return errorResponse(error);
  }
}
