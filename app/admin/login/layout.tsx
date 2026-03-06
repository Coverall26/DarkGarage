/**
 * Admin Login Layout — Standalone auth layout for /admin/login.
 *
 * This layout is intentionally separate from the main admin layout
 * (app/admin/layout.tsx) because the login page must render WITHOUT
 * the AdminSidebar, DashboardHeader, or any authenticated shell.
 *
 * Provides:
 *   - SessionProvider  — NextAuth session context for login form
 *   - ThemeProvider     — dark theme default (matches admin portal)
 *   - Toaster           — sonner toast notifications for login errors
 *
 * Pattern: Any admin route that must render for unauthenticated users
 * (login, password reset, magic link verify) should nest under this
 * layout or a similar standalone layout — never under the authenticated
 * admin layout which requires a valid session.
 */
"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <main>
          <Toaster closeButton richColors theme="dark" />
          <div>{children}</div>
        </main>
      </ThemeProvider>
    </SessionProvider>
  );
}
