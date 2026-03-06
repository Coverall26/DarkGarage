"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    description: "Dataroom only — share documents securely.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Start Free",
    href: "/coming-soon/signup",
    highlighted: false,
    suiteAccess: ["DataRoom", "RaiseCRM (basic)", "SignSuite (10/mo)"],
    features: [
      { name: "Secure dataroom", included: true },
      { name: "Shareable links with analytics", included: true },
      { name: "20 CRM contacts", included: true },
      { name: "10 e-signatures/month", included: true },
      { name: "40 signers storage", included: true },
      { name: "Email gate & NDA gate", included: true },
      { name: "Lara AI (quick actions)", included: true },
      { name: "Investor onboarding wizard", included: false },
      { name: "Wire transfer tracking", included: false },
      { name: "Kanban pipeline", included: false },
      { name: "Custom branding", included: false },
      { name: "API access", included: false },
    ],
  },
  {
    name: "Pro",
    description: "CRM + e-signatures for growing teams.",
    monthlyPrice: 29,
    yearlyPrice: 23,
    cta: "Start Trial",
    href: "/coming-soon/signup",
    highlighted: false,
    suiteAccess: ["DataRoom", "RaiseCRM", "SignSuite (25/mo)", "RaiseRoom"],
    features: [
      { name: "Everything in Free", included: true },
      { name: "Unlimited CRM contacts", included: true },
      { name: "25 e-signatures/month", included: true },
      { name: "100 signers storage", included: true },
      { name: "Kanban pipeline view", included: true },
      { name: "Outreach & email tracking", included: true },
      { name: "Custom branding", included: true },
      { name: "API access", included: true },
      { name: "Lara AI (outreach drafts)", included: true },
      { name: "Investor onboarding wizard", included: false },
      { name: "Wire transfer tracking", included: false },
      { name: "White-label portal", included: false },
    ],
  },
  {
    name: "Business",
    description: "Advanced CRM with unlimited signers and analytics.",
    monthlyPrice: 39,
    yearlyPrice: 32,
    cta: "Start Trial",
    href: "/coming-soon/signup",
    highlighted: false,
    suiteAccess: ["DataRoom", "RaiseCRM", "SignSuite (75/mo)", "RaiseRoom"],
    features: [
      { name: "Everything in Pro", included: true },
      { name: "75 e-signatures/month", included: true },
      { name: "Unlimited contacts & signers", included: true },
      { name: "10 email templates", included: true },
      { name: "Kanban pipeline view", included: true },
      { name: "Outreach & email tracking", included: true },
      { name: "Custom branding", included: true },
      { name: "API access", included: true },
      { name: "Lara AI (analytics + insights)", included: true },
      { name: "Investor onboarding wizard", included: false },
      { name: "Wire transfer tracking", included: false },
      { name: "White-label portal", included: false },
    ],
  },
  {
    name: "FundRoom",
    description: "Full GP/LP platform for active fund managers.",
    monthlyPrice: 79,
    yearlyPrice: 63,
    cta: "Get Started",
    href: "/coming-soon/signup",
    highlighted: true,
    suiteAccess: ["RaiseRoom", "SignSuite", "RaiseCRM", "DataRoom", "FundRoom", "Lara AI"],
    features: [
      { name: "Everything in Business", included: true },
      { name: "Unlimited e-signatures", included: true },
      { name: "Unlimited storage", included: true },
      { name: "Investor onboarding wizard", included: true },
      { name: "Wire transfer tracking", included: true },
      { name: "7-stage investor pipeline", included: true },
      { name: "GP approval workflows", included: true },
      { name: "SEC Form D export", included: true },
      { name: "Compliance dashboard", included: true },
      { name: "Capital calls & distributions", included: true },
      { name: "White-label investor portal", included: true },
      { name: "Lara AI (compliance + insights)", included: true },
      { name: "Priority support", included: true },
    ],
  },
];

const AI_ADDON = {
  name: "AI CRM Engine",
  description: "AI-powered email drafts, investor insights, and engagement scoring.",
  monthlyPrice: 49,
  yearlyPrice: 39,
};

const COMPETITOR_COMPARISON = [
  { name: "DocuSign", price: "$35/mo" },
  { name: "Dropbox", price: "$25/mo" },
  { name: "DocSend", price: "$45/mo" },
  { name: "HubSpot CRM", price: "$50/mo" },
  { name: "Carta", price: "$5K/yr" },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  const competitorTotal = "$572/mo";

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
            Five platforms. One price. Zero friction.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Stop paying for 5 tools. FundRoom AI bundles everything you need to
            raise capital, manage investors, and stay compliant.
          </p>

          {/* Competitor Comparison */}
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-500">
              {COMPETITOR_COMPARISON.map((comp, i) => (
                <span key={comp.name}>
                  <span className="line-through">{comp.name} ({comp.price})</span>
                  {i < COMPETITOR_COMPARISON.length - 1 && <span className="ml-4">+</span>}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="text-lg text-gray-400 line-through font-mono">{competitorTotal}</span>
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <span className="text-2xl font-bold text-[#8B5CF6] font-mono">$79/mo</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              FundRoom AI: RaiseRoom + SignSuite + RaiseCRM + DataRoom + FundRoom
            </p>
          </div>

          {/* Toggle */}
          <div className="mt-10 flex items-center justify-center gap-3">
            <span className={cn("text-sm font-medium", !annual ? "text-gray-900" : "text-gray-500")}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                annual ? "bg-[#8B5CF6]" : "bg-gray-200",
              )}
              aria-label="Toggle annual billing"
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  annual && "translate-x-5",
                )}
              />
            </button>
            <span className={cn("text-sm font-medium", annual ? "text-gray-900" : "text-gray-500")}>
              Annual
              <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-2xl border p-6 flex flex-col transition-shadow",
                plan.highlighted
                  ? "border-[#8B5CF6] shadow-xl shadow-purple-100 ring-1 ring-[#8B5CF6]"
                  : "border-gray-200 hover:shadow-lg",
              )}
            >
              {plan.highlighted && (
                <div className="mb-3 inline-flex self-start rounded-full bg-[#8B5CF6] px-3 py-1 text-xs font-medium text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900 font-mono tabular-nums">
                  ${annual ? plan.yearlyPrice : plan.monthlyPrice}
                </span>
                <span className="text-sm text-gray-500">/mo</span>
                {annual && plan.monthlyPrice > 0 && (
                  <span className="ml-2 text-xs text-gray-400 line-through font-mono">
                    ${plan.monthlyPrice}/mo
                  </span>
                )}
              </div>
              <Link
                href={plan.href}
                className={cn(
                  "mt-5 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors",
                  plan.highlighted
                    ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                )}
              >
                {plan.cta}
              </Link>

              {/* Suite access chips */}
              <div className="mt-4 flex flex-wrap gap-1">
                {plan.suiteAccess.map((suite) => (
                  <span
                    key={suite}
                    className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                  >
                    {suite}
                  </span>
                ))}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-2 text-sm">
                    {feature.included ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-gray-300 mt-0.5" />
                    )}
                    <span className={feature.included ? "text-gray-700" : "text-gray-400"}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* AI Add-on */}
        <div className="mt-12 rounded-2xl border border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{AI_ADDON.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{AI_ADDON.description}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-bold text-gray-900 font-mono">
                +${annual ? AI_ADDON.yearlyPrice : AI_ADDON.monthlyPrice}
              </span>
              <span className="text-sm text-gray-500">/mo</span>
              <p className="mt-1 text-xs text-gray-500">14-day free trial</p>
            </div>
          </div>
        </div>

        {/* Start Free CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/coming-soon/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-[#7C3AED]"
          >
            Start Free
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            No credit card required. Upgrade anytime.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              {
                q: "Can I start free and upgrade later?",
                a: "Yes. The Free plan includes a secure dataroom, shareable links, and basic CRM. Upgrade to Pro, Business, or FundRoom when you're ready to onboard investors.",
              },
              {
                q: "What happens to my data if I downgrade?",
                a: "Your data is never deleted. On downgrade, excess contacts become read-only, and e-signature limits reset at the next billing cycle. You can always view existing records.",
              },
              {
                q: "Is there a minimum commitment?",
                a: "No. Monthly plans can be cancelled anytime. Annual plans are billed upfront with a 20% discount.",
              },
              {
                q: "Do you support multi-fund setups?",
                a: "Yes. Each fund gets its own pipeline, documents, and wire tracking. Investors can be associated with multiple funds. Available on the FundRoom tier.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="font-medium text-gray-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
