"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sanitizeCss } from "@/lib/utils/sanitize-css";
import { type OfferingData, formatCurrency, formatPercent, getRegDLabel } from "./types";
import {
  StickyTopBar,
  HeroSection,
  MetricsBar,
  DescriptionSection,
  HighlightsSection,
  TimelineSection,
  DealTermsSection,
  FinancialProjectionsSection,
  AdvantagesSection,
  LeadershipSection,
  GallerySection,
  DocumentsSection,
  FinalCTA,
  ComplianceFooter,
  EmailGateModal,
} from "./sections";

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OfferingPageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [data, setData] = useState<OfferingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateName, setGateName] = useState("");
  const [gateAccredited, setGateAccredited] = useState(false);
  const [gateSubmitted, setGateSubmitted] = useState(false);
  const [isGateSubmitting, setIsGateSubmitting] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/offering/${slug}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Offering not found");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleInvest = useCallback(() => {
    if (!data) return;
    router.push(
      `/lp/onboard?fundId=${data.fundId}&teamId=${data.teamId}&ref=offering-${slug}`
    );
  }, [data, slug, router]);

  const handleEmailGateSubmit = useCallback(async () => {
    if (!gateEmail || !gateName || !data) return;
    setIsGateSubmitting(true);
    try {
      await fetch("/api/lp/express-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gateEmail, name: gateName, accredited: gateAccredited, source: `offering-${slug}` }),
      });
    } catch (error) {
      // Non-blocking
    }
    setGateSubmitted(true);
    setIsGateSubmitting(false);
    setShowEmailGate(false);
  }, [gateEmail, gateName, gateAccredited, data, slug]);

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1628]">
        {/* Skeleton nav */}
        <div className="h-[72px] border-b border-white/5 flex items-center justify-between px-6 sm:px-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-4 w-24 bg-white/5 rounded animate-pulse hidden sm:block" />
          </div>
          <div className="hidden lg:flex items-center gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 w-16 bg-white/5 rounded animate-pulse" />
            ))}
            <div className="h-9 w-24 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Skeleton hero */}
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20">
          <div className="grid lg:grid-cols-5 gap-12 items-center">
            <div className="lg:col-span-3 space-y-6">
              <div className="h-5 w-32 bg-white/5 rounded-full animate-pulse" />
              <div className="space-y-3">
                <div className="h-10 w-3/4 bg-white/5 rounded animate-pulse" />
                <div className="h-10 w-1/2 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-5 w-full max-w-md bg-white/5 rounded animate-pulse" />
              <div className="flex gap-4">
                <div className="h-12 w-36 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-12 w-36 bg-white/5 rounded-xl animate-pulse" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white/5 rounded-2xl p-8 space-y-4">
                <div className="flex justify-between"><div className="h-4 w-24 bg-white/5 rounded animate-pulse" /><div className="h-5 w-12 bg-white/5 rounded-full animate-pulse" /></div>
                <div className="h-3 w-full bg-white/5 rounded-full animate-pulse" />
                <div className="grid grid-cols-2 gap-4"><div className="h-16 bg-white/5 rounded-xl animate-pulse" /><div className="h-16 bg-white/5 rounded-xl animate-pulse" /></div>
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton metrics bar */}
        <div className="bg-[#0d1a35] border-t border-b border-white/5 py-6">
          <div className="max-w-7xl mx-auto px-6 sm:px-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="text-center space-y-2">
                  <div className="h-8 w-20 bg-white/5 rounded animate-pulse mx-auto" />
                  <div className="h-3 w-24 bg-white/5 rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Offering Not Found</h1>
          <p className="text-gray-400 mb-6">
            This offering page may have been removed or is not yet published.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const brandColor = data.brandColor || "#0066FF";
  const accentBg = data.accentColor || "#0A1628";
  const raisePct = data.targetRaise
    ? Math.min(
        100,
        (parseFloat(data.totalCommitted || "0") /
          parseFloat(data.targetRaise)) *
          100
      )
    : 0;

  // Build default deal terms from fund data if GP hasn't configured custom ones
  const effectiveDealTerms: Array<{ label: string; value: string }> =
    (data.dealTerms as Array<{ label: string; value: string }>) ||
    [
      data.regulationDExemption && {
        label: "SEC Exemption",
        value: getRegDLabel(data.regulationDExemption),
      },
      data.minimumInvestment && {
        label: "Minimum Investment",
        value: formatCurrency(data.minimumInvestment, data.currency),
      },
      data.managementFeePct && {
        label: "Management Fee",
        value: formatPercent(data.managementFeePct),
      },
      data.carryPct && {
        label: "Carried Interest",
        value: formatPercent(data.carryPct),
      },
      data.hurdleRate && {
        label: "Hurdle Rate",
        value: formatPercent(data.hurdleRate),
      },
      data.termYears && {
        label: "Fund Term",
        value: `${data.termYears} years${data.extensionYears ? ` + ${data.extensionYears} ext.` : ""}`,
      },
      data.waterfallType && {
        label: "Distribution Waterfall",
        value: data.waterfallType === "EUROPEAN"
          ? "European (Whole Fund)"
          : data.waterfallType === "AMERICAN"
            ? "American (Deal-by-Deal)"
            : data.waterfallType,
      },
    ].filter(Boolean) as Array<{ label: string; value: string }>;

  // Build default key metrics from fund data
  const effectiveMetrics: Array<{ label: string; value: string; subtext?: string }> =
    (data.keyMetrics as Array<{ label: string; value: string; subtext?: string }>) || [
      {
        label: "Target Raise",
        value: formatCurrency(data.targetRaise, data.currency),
      },
      {
        label: "Capital Committed",
        value: formatCurrency(data.totalCommitted, data.currency),
        subtext: `${raisePct.toFixed(0)}% of target`,
      },
      {
        label: "Minimum Investment",
        value: formatCurrency(data.minimumInvestment, data.currency),
      },
      {
        label: "Investors",
        value: `${data.investorCount}`,
        subtext: data.fundStatus === "RAISING" ? "Accepting new investors" : undefined,
      },
    ];

  return (
    <div
      className="min-h-screen"
      style={
        {
          "--brand-color": brandColor,
          "--accent-bg": accentBg,
          "--brand-color-glow": `${brandColor}10`,
        } as React.CSSProperties
      }
    >
      {/* Premium fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        html { scroll-behavior: smooth; }
        .offering-heading { font-family: 'EB Garamond', Georgia, serif; }
        .offering-section-glow { position: relative; overflow: hidden; }
        .offering-section-glow::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--brand-color) 0%, transparent 70%);
          opacity: 0.03;
          pointer-events: none;
        }
        .offering-card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .offering-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 60px var(--brand-color-glow, rgba(0,102,255,0.06));
          border-color: rgba(255,255,255,0.15);
        }
        @media (prefers-reduced-motion: reduce) {
          .offering-card-hover:hover { transform: none; }
          .offering-section-glow::before { display: none; }
        }
      `}</style>
      {/* Inject custom CSS if provided */}
      {data.customCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(data.customCss) }} />}

      {/* ─── Sticky Top Bar ──────────────────────────────────────────────── */}
      <StickyTopBar
        data={data}
        brandColor={brandColor}
        raisePct={raisePct}
        onInvest={handleInvest}
        scrollY={scrollY}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      {/* ─── Hero Section ────────────────────────────────────────────────── */}
      <HeroSection
        data={data}
        brandColor={brandColor}
        raisePct={raisePct}
        onInvest={handleInvest}
      />

      {/* ─── Key Metrics Bar ─────────────────────────────────────────────── */}
      <MetricsBar metrics={effectiveMetrics} brandColor={brandColor} />

      {/* ─── Offering Description ────────────────────────────────────────── */}
      {data.offeringDescription && (
        <DescriptionSection
          description={data.offeringDescription}
          orgName={data.orgName}
          orgDescription={data.orgDescription}
          orgCity={data.orgCity}
          orgState={data.orgState}
          orgSector={data.orgSector}
          orgFoundedYear={data.orgFoundedYear}
          orgLogo={data.logoUrl}
        />
      )}

      {/* ─── Investment Highlights ────────────────────────────────────────── */}
      {data.highlights && (data.highlights as Array<{ title: string; description: string }>).length > 0 && (
        <HighlightsSection
          highlights={data.highlights as Array<{ title: string; description: string; icon?: string }>}
          brandColor={brandColor}
        />
      )}

      {/* ─── Timeline / Milestones ────────────────────────────────────────── */}
      {data.timeline && (data.timeline as Array<{ date: string; title: string }>).length > 0 && (
        <TimelineSection
          timeline={
            data.timeline as Array<{
              date: string;
              title: string;
              description?: string;
              status: "completed" | "current" | "upcoming";
            }>
          }
          brandColor={brandColor}
        />
      )}

      {/* ─── Deal Structure / Terms ──────────────────────────────────────── */}
      {effectiveDealTerms.length > 0 && (
        <DealTermsSection terms={effectiveDealTerms} brandColor={brandColor} />
      )}

      {/* ─── Financial Projections ────────────────────────────────────────── */}
      {data.financialProjections && (
        <FinancialProjectionsSection
          projections={
            data.financialProjections as {
              sections: Array<{
                title: string;
                headers: string[];
                rows: Array<{ label: string; values: string[] }>;
              }>;
            }
          }
          brandColor={brandColor}
        />
      )}

      {/* ─── Competitive Advantages ──────────────────────────────────────── */}
      {data.advantages && (data.advantages as Array<{ title: string; description: string }>).length > 0 && (
        <AdvantagesSection
          advantages={data.advantages as Array<{ title: string; description: string; icon?: string }>}
          brandColor={brandColor}
        />
      )}

      {/* ─── Leadership Team ─────────────────────────────────────────────── */}
      {data.leadership && (data.leadership as Array<{ name: string; title: string }>).length > 0 && (
        <LeadershipSection
          leadership={
            data.leadership as Array<{
              name: string;
              title: string;
              bio?: string;
              imageUrl?: string;
            }>
          }
          brandColor={brandColor}
        />
      )}

      {/* ─── Gallery ─────────────────────────────────────────────────────── */}
      {data.gallery && (data.gallery as Array<{ url: string }>).length > 0 && (
        <GallerySection
          gallery={data.gallery as Array<{ url: string; caption?: string; type: "image" | "video" }>}
        />
      )}

      {/* ─── Dataroom Documents ──────────────────────────────────────────── */}
      {data.dataroomDocuments &&
        (data.dataroomDocuments as Array<{ name: string }>).length > 0 && (
          <DocumentsSection
            documents={
              data.dataroomDocuments as Array<{
                name: string;
                type: string;
                isGated: boolean;
                url?: string;
              }>
            }
            brandColor={brandColor}
            emailGateEnabled={data.emailGateEnabled}
            gateSubmitted={gateSubmitted}
            onRequestAccess={() => setShowEmailGate(true)}
          />
        )}

      {/* ─── Final CTA ───────────────────────────────────────────────────── */}
      <FinalCTA
        data={data}
        brandColor={brandColor}
        onInvest={handleInvest}
      />

      {/* ─── Compliance Footer ───────────────────────────────────────────── */}
      <ComplianceFooter
        data={data}
        brandColor={brandColor}
      />

      {/* ─── Email Gate Modal ────────────────────────────────────────────── */}
      {showEmailGate && (
        <EmailGateModal
          email={gateEmail}
          setEmail={setGateEmail}
          name={gateName}
          setName={setGateName}
          accredited={gateAccredited}
          setAccredited={setGateAccredited}
          onSubmit={handleEmailGateSubmit}
          onClose={() => setShowEmailGate(false)}
          isSubmitting={isGateSubmitting}
          brandColor={brandColor}
        />
      )}
    </div>
  );
}
