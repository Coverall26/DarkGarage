import {
  Zap,
  FileSignature,
  PieChart,
  Users,
  Rocket,
  Building,
  Home,
  TrendingUp,
  Target,
  Search,
  Layers,
  Settings,
} from "lucide-react";
import type { WizardData } from "../hooks/useWizardState";

// ---------- Shared Props ----------

export interface Step6Props {
  data: WizardData;
  updateField: <K extends keyof WizardData>(field: K, value: WizardData[K]) => void;
}

// ---------- Constants ----------

export const WATERFALL_TYPES = [
  { value: "EUROPEAN", label: "European (Whole Fund)" },
  { value: "AMERICAN", label: "American (Deal-by-Deal)" },
];

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

export const INSTRUMENTS = [
  {
    value: "SAFE",
    label: "SAFE",
    icon: Zap,
    desc: "Simple Agreement for Future Equity. Most common for pre-seed/seed.",
  },
  {
    value: "CONVERTIBLE_NOTE",
    label: "Convertible Note",
    icon: FileSignature,
    desc: "Debt that converts to equity. Interest accrues. Has maturity date.",
  },
  {
    value: "PRICED_ROUND",
    label: "Priced Round",
    icon: PieChart,
    desc: "Series A+. Fixed share price. Full cap table impact.",
  },
  {
    value: "SPV",
    label: "SPV / Co-Invest",
    icon: Users,
    desc: "Special Purpose Vehicle for a single deal. Pool investors into one entity.",
  },
];

export const FUND_TYPE_CARDS = [
  { type: "VENTURE_CAPITAL", icon: Rocket, title: "Venture Capital", badge: "2/20, 10yr, European" },
  { type: "PRIVATE_EQUITY", icon: Building, title: "Private Equity", badge: "2/20, 7yr, European" },
  { type: "REAL_ESTATE", icon: Home, title: "Real Estate", badge: "1.5/20, 7yr, American" },
  { type: "HEDGE_FUND", icon: TrendingUp, title: "Hedge Fund", badge: "2/20, Open-ended, HWM" },
  { type: "SPV_COINVEST", icon: Target, title: "SPV / Co-Invest", badge: "0/20, Deal-by-deal" },
  { type: "SEARCH_FUND", icon: Search, title: "Search Fund", badge: "2/20, 2yr + 5yr" },
  { type: "FUND_OF_FUNDS", icon: Layers, title: "Fund of Funds", badge: "1/10, 10yr, European" },
  { type: "CUSTOM", icon: Settings, title: "Custom", badge: "No defaults" },
] as const;

export const MARKETPLACE_CATEGORIES = [
  "Venture Capital",
  "Private Equity",
  "Real Estate",
  "Infrastructure",
  "Credit",
  "Multi-Strategy",
  "Other",
];
