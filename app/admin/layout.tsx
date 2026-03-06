import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { LaraChat } from "@/components/lara/lara-chat";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Unauthenticated users see pages without sidebar (e.g. /admin/login)
  if (!session?.user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-[#0066FF] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main id="main-content" className="flex-1 overflow-auto bg-[#f8fafc] dark:bg-muted/20" tabIndex={-1}>
          <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
            {children}
          </div>
        </main>
      </div>
      <LaraChat />
    </div>
  );
}
