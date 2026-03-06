import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  FileSignature,
  Users,
  BarChart3,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FolderLock,
  Sparkles,
  DollarSign,
  Clock,
  Rocket,
  Building,
} from "lucide-react";

export const metadata: Metadata = {
  title: "FundRoom AI — Modern Fund Management Platform",
  description:
    "Secure GP/LP management, investor onboarding, e-signatures, and SEC-compliant datarooms. Built for fund managers who move fast.",
  openGraph: {
    title: "FundRoom AI — Modern Fund Management Platform",
    description:
      "Secure GP/LP management, investor onboarding, e-signatures, and SEC-compliant datarooms.",
    type: "website",
    url: "https://fundroom.ai",
    siteName: "FundRoom AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "FundRoom AI — Modern Fund Management Platform",
    description:
      "The all-in-one platform for fund managers. Investor onboarding, e-signatures, wire tracking, SEC compliance, and secure datarooms.",
  },
  other: {
    "script:ld+json": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "FundRoom AI",
      url: "https://fundroom.ai",
      description:
        "Modern fund management platform — investor onboarding, e-signatures, wire tracking, SEC compliance, and secure datarooms.",
      foundingDate: "2024",
      sameAs: [
        "https://twitter.com/fundroomai",
        "https://linkedin.com/company/fundroom",
      ],
    }),
  },
};

const FEATURES = [
  {
    icon: FileSignature,
    title: "Native E-Signatures",
    description:
      "SignSuite — zero external API cost. HTML5 signature capture with PDF overlay. SEC/ESIGN compliant.",
  },
  {
    icon: Users,
    title: "Investor Onboarding",
    description:
      "6-step wizard: NDA, accreditation, entity setup, commitment, signing, and funding — all in one flow.",
  },
  {
    icon: Shield,
    title: "SEC Compliance",
    description:
      "Built-in 506(b)/506(c) compliance, Form D data export, accreditation verification, and immutable audit trails.",
  },
  {
    icon: BarChart3,
    title: "Investor Pipeline",
    description:
      "Track every investor from lead to funded. 7-stage pipeline with engagement scoring and approval workflows.",
  },
  {
    icon: Lock,
    title: "Secure Datarooms",
    description:
      "Share documents with granular permissions, watermarking, download controls, and real-time analytics.",
  },
  {
    icon: Zap,
    title: "GP Dashboard",
    description:
      "Wire confirmations, document reviews, pending actions, and fund metrics — all in one command center.",
  },
];

const SUITES = [
  {
    name: "RaiseRoom",
    color: "#06B6D4",
    icon: TrendingUp,
    description: "Capital raise management — pipeline, offering pages, and fund overview.",
  },
  {
    name: "SignSuite",
    color: "#10B981",
    icon: FileSignature,
    description: "Native e-signatures — envelopes, templates, and sequential signing.",
  },
  {
    name: "RaiseCRM",
    color: "#F59E0B",
    icon: Users,
    description: "Investor CRM pipeline — Kanban, engagement scoring, and AI outreach.",
  },
  {
    name: "DataRoom",
    color: "#2563EB",
    icon: FolderLock,
    description: "Secure document filing — vaults, activity logs, and access controls.",
  },
  {
    name: "FundRoom",
    color: "#8B5CF6",
    icon: Shield,
    description: "Full GP/LP operations — capital calls, distributions, and compliance.",
  },
];

const STATS = [
  { value: "AES-256", label: "Encryption" },
  { value: "SOC 2", label: "Compliance Ready" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "< 2s", label: "Page Load" },
];

const COMPETITORS = [
  { name: "DocuSign", cost: "$35/mo" },
  { name: "Dropbox", cost: "$25/mo" },
  { name: "DocSend", cost: "$45/mo" },
  { name: "HubSpot CRM", cost: "$50/mo" },
  { name: "Carta", cost: "$5K/yr" },
];

const TIMELINE_STAGES = [
  {
    phase: "Pre-Raise",
    icon: Building,
    items: ["Set up fund structure", "Configure investor onboarding", "Prepare dataroom & templates"],
  },
  {
    phase: "Active Raise",
    icon: Rocket,
    items: ["Investor pipeline & CRM", "E-signature workflows", "Wire tracking & confirmations"],
  },
  {
    phase: "Post-Close",
    icon: CheckCircle2,
    items: ["Capital call management", "Distribution waterfalls", "SEC Form D export"],
  },
  {
    phase: "Ongoing Ops",
    icon: TrendingUp,
    items: ["Investor portal & reporting", "Document vault", "Compliance audit trail"],
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FundRoom AI",
  url: "https://fundroom.ai",
  description:
    "Modern fund management platform — investor onboarding, e-signatures, wire tracking, SEC compliance, and secure datarooms.",
  foundingDate: "2024",
  sameAs: [
    "https://twitter.com/fundroomai",
    "https://linkedin.com/company/fundroom",
  ],
};

export default function MarketingHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Now accepting GP applications
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Fund Management,{" "}
              <span className="text-[#0066FF]">Simplified</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
              The all-in-one platform for fund managers. Investor onboarding,
              e-signatures, wire tracking, SEC compliance, and secure
              datarooms — no duct-taping tools together.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/coming-soon/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0066FF] px-6 py-3 text-base font-medium text-white shadow-lg shadow-blue-500/25 hover:bg-[#0052CC] transition-all hover:shadow-xl hover:shadow-blue-500/30"
              >
                Start Free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-gray-900 font-mono">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything you need to run a fund
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Stop juggling DocuSign, Dropbox, spreadsheets, and email. One
              platform, zero friction.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#0066FF]">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Five Suites */}
      <section className="bg-gray-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Five Suites. One Platform.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Modular product suites that work independently or together as a
              unified fund operations engine.
            </p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {SUITES.map((suite) => (
              <div
                key={suite.name}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:shadow-lg"
                style={{ borderTopColor: suite.color, borderTopWidth: "3px" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${suite.color}15`, color: suite.color }}
                >
                  <suite.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  {suite.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {suite.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet Lara AI */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700 mb-4">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                AI-Powered
              </div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Meet Lara — Your AI Concierge
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Lara is an always-available, context-aware AI assistant that
                understands your fund, your investors, and your workflow.
                Available on every page, she helps you move faster.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  "Outreach Drafting",
                  "Compliance Flagging",
                  "Engagement Insights",
                  "Pipeline Summaries",
                  "Document Assistance",
                ].map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6]">
                    <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Lara</div>
                    <div className="text-xs text-gray-500">FundRoom AI Concierge</div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    3 investors are overdue for follow-up. Want me to draft outreach emails?
                  </div>
                  <div className="rounded-lg bg-[#0066FF] p-3 text-sm text-white">
                    Yes, prioritize by engagement score
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    Done — 3 personalized drafts ready in your outreach queue.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Replace Your Entire Stack */}
      <section className="bg-[#0A1628] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Replace Your Entire Stack
            </h2>
            <p className="mt-4 text-lg text-gray-400">
              Stop paying for five tools that don&apos;t talk to each other.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {COMPETITORS.map((comp) => (
              <div
                key={comp.name}
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-center"
              >
                <div className="text-sm font-medium text-gray-400 line-through">
                  {comp.name}
                </div>
                <div className="mt-1 text-lg font-mono font-bold text-red-400">
                  {comp.cost}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center">
            <div className="text-center">
              <div className="text-sm text-gray-400">vs. FundRoom all-in-one</div>
              <div className="mt-2 text-4xl font-mono font-bold text-emerald-400">
                $79<span className="text-lg text-gray-400">/mo</span>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Save 86% — replace $572/mo in tools with one platform
              </div>
            </div>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0066FF] px-6 py-3 text-sm font-medium text-white hover:bg-[#0052CC] transition-colors"
            >
              Compare Plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Lifecycle Timeline */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Your Raise Ends. FundRoom Doesn&apos;t.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From first pitch to ongoing operations — one platform for the
              entire fund lifecycle.
            </p>
          </div>
          <div className="mt-16 grid gap-1 md:grid-cols-4">
            {TIMELINE_STAGES.map((stage, index) => (
              <div key={stage.phase} className="relative">
                {index < TIMELINE_STAGES.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+24px)] right-0 h-0.5 bg-gradient-to-r from-[#0066FF] to-blue-200" aria-hidden="true" />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0066FF] text-white">
                    <stage.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">
                    {stage.phase}
                  </h3>
                  <ul className="mt-3 space-y-1.5">
                    {stage.items.map((item) => (
                      <li key={item} className="text-sm text-gray-600">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Live in 15 minutes
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From signup to first investor invite — faster than reading your PPM.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Set up your fund",
                description:
                  "9-step wizard: company info, branding, fund economics, investor onboarding settings, and document templates.",
              },
              {
                step: "2",
                title: "Invite investors",
                description:
                  "Share a dataroom link or send direct invites. Investors onboard themselves through a guided flow.",
              },
              {
                step: "3",
                title: "Close your raise",
                description:
                  "Track commitments, confirm wires, manage approvals, and generate SEC filings — all from your dashboard.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0066FF] text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Built for compliance-first funds
          </h2>
          <ul className="mt-8 space-y-3 text-left">
            {[
              "AES-256-GCM encryption for all sensitive data (SSN, EIN, wire details)",
              "SHA-256 hash-chained immutable audit logs for SEC 506(c) compliance",
              "Multi-tenant isolation with org-scoped queries on every table",
              "RBAC (Owner, Admin, Manager, Member) with edge-level JWT enforcement",
              "ESIGN Act & UETA compliant native e-signature system",
              "CSRF protection, rate limiting, bot detection, and HSTS headers",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-gray-600">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0A1628] py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to modernize your fund ops?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Join fund managers who have ditched the spreadsheet-and-DocuSign
            workflow.
          </p>
          <div className="mt-8">
            <Link
              href="/coming-soon/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0066FF] px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 hover:bg-[#0052CC] transition-all"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
