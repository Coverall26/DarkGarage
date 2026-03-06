"use client";

import { useState } from "react";
import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Marketing Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <div className="h-8 w-8 rounded-lg bg-[#0066FF] flex items-center justify-center" aria-hidden="true">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            FundRoom
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link href="/security" className="hover:text-gray-900 transition-colors">
              Security
            </Link>
            <Link href="/compliance" className="hover:text-gray-900 transition-colors">
              Compliance
            </Link>
            <Link href="https://docs.fundroom.ai" className="hover:text-gray-900 transition-colors">
              Docs
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/coming-soon/signup"
              className="rounded-lg bg-[#0066FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0052CC] transition-colors"
            >
              Get Started
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </nav>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3" role="menu">
            <Link href="/pricing" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2 min-h-[44px] flex items-center" role="menuitem" onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </Link>
            <Link href="/security" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2 min-h-[44px] flex items-center" role="menuitem" onClick={() => setMobileMenuOpen(false)}>
              Security
            </Link>
            <Link href="/compliance" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2 min-h-[44px] flex items-center" role="menuitem" onClick={() => setMobileMenuOpen(false)}>
              Compliance
            </Link>
            <Link href="https://docs.fundroom.ai" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2 min-h-[44px] flex items-center" role="menuitem" onClick={() => setMobileMenuOpen(false)}>
              Docs
            </Link>
            <Link href="/login" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2 min-h-[44px] flex items-center sm:hidden" role="menuitem" onClick={() => setMobileMenuOpen(false)}>
              Log in
            </Link>
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Product</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li><Link href="/pricing" className="hover:text-gray-900">Pricing</Link></li>
                <li><Link href="/security" className="hover:text-gray-900">Security</Link></li>
                <li><Link href="https://docs.fundroom.ai" className="hover:text-gray-900">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Company</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li><Link href="/terms" className="hover:text-gray-900">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link></li>
                <li><Link href="/compliance" className="hover:text-gray-900">Compliance</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Support</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li><a href="mailto:support@fundroom.ai" className="hover:text-gray-900">support@fundroom.ai</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Connect</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-500">
                <li><a href="https://twitter.com/fundroomai" className="hover:text-gray-900">Twitter</a></li>
                <li><a href="https://linkedin.com/company/fundroom" className="hover:text-gray-900">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-8">
            <p className="text-xs text-gray-400 leading-relaxed max-w-3xl mx-auto text-center">
              FundRoom AI provides technology tools for fund administration and investor management.
              FundRoom AI is not a broker-dealer, investment adviser, or funding portal, and does not
              provide investment advice or recommendations. Securities offerings are made solely by
              the issuing entities. All investments involve risk, including the possible loss of
              principal.
            </p>
            <p className="mt-4 text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} White Label Hosting Solutions. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
