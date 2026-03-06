/**
 * INTENTIONALLY NOT IN SIDEBAR — Email workflow entry point.
 *
 * This page is accessed via magic links sent to GP admins when external users
 * request dataroom access (see pages/api/request-invite.ts). The admin receives
 * an email with `/admin/quick-add?email=xxx` which lands here.
 *
 * The canonical quick-add UI for in-app use is the QuickAddModal component
 * rendered in dataroom headers (components/datarooms/quick-add-modal.tsx).
 */
import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import QuickAddPageClient from "./page-client";
import LoadingSpinner from "@/components/ui/loading-spinner";

export const metadata: Metadata = {
  title: "Quick Add User | FundRoom",
  description: "Add investors to a dataroom with one click",
};

interface QuickAddPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function QuickAddPage({ searchParams }: QuickAddPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;

  if (!session) {
    const callbackUrl = params?.email 
      ? `/admin/quick-add?email=${encodeURIComponent(params.email)}`
      : "/admin/quick-add";
    
    redirect(`/login?next=${encodeURIComponent(callbackUrl)}`);
  }

  const user = session.user as CustomUser;

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId: user.id,
    },
  });

  if (!userTeam) {
    redirect("/viewer-portal");
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      }
    >
      <QuickAddPageClient />
    </Suspense>
  );
}
