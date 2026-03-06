import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Intent detection & canned responses (v1)
// ---------------------------------------------------------------------------

interface IntentResponse {
  text: string;
  followUps?: string[];
}

interface Intent {
  pattern: RegExp;
  response: string | ((ctx: ChatContext) => IntentResponse | string);
}

interface ChatContext {
  suite: string;
  page: string;
  pathname: string;
  tier: string;
}

const INTENTS: Intent[] = [
  // Greetings
  {
    pattern: /^(hi|hello|hey|howdy|what's up|whats up)/i,
    response: () => ({
      text: "Hey! I'm Lara, your AI concierge. I can help you navigate FundRoom, draft emails, check on your pipeline, and more. What would you like to do?",
      followUps: [
        "What can you help me with?",
        "Show me my pipeline",
        "Check pending signatures",
      ],
    }),
  },
  // Help / capabilities
  {
    pattern: /(what can you|help me|what do you do|your capabilities)/i,
    response: () => ({
      text: "I can help with:\n\n\u2022 Drafting investor outreach emails\n\u2022 Checking pending signatures and approvals\n\u2022 Summarizing viewer engagement\n\u2022 Finding documents in your DataRoom\n\u2022 Checking compliance status\n\u2022 Reminding you about upcoming deadlines\n\nJust ask!",
      followUps: [
        "Draft an outreach email",
        "Check my deadlines",
        "Find a document",
      ],
    }),
  },
  // Draft email / outreach
  {
    pattern: /(draft|write|compose).*(email|outreach|message|letter)/i,
    response: (ctx) => ({
      text:
        ctx.suite === "pipelineiq"
          ? "I'd love to help draft an outreach email! Head to PipelineIQ > Outreach to use the AI Draft feature. You can select a contact and I'll generate a personalized email based on their engagement history."
          : "I can help draft emails! Navigate to PipelineIQ > Outreach where you'll find the AI Draft tool. Select your recipients and I'll help compose a compelling message.",
      followUps: [
        "Take me to Outreach",
        "Show me my contacts",
        "Check engagement scores",
      ],
    }),
  },
  // Check signatures / pending
  {
    pattern: /(check|pending|status).*(signature|signing|envelope|sign)/i,
    response: () => ({
      text: "You can view all pending signatures in SignSuite. Head to [SignSuite](/admin/signsuite) and check the 'Active' tab for envelopes awaiting signatures.",
      followUps: [
        "Send a new envelope",
        "Check completed signatures",
        "View templates",
      ],
    }),
  },
  // Viewer activity / engagement
  {
    pattern: /(summarize|check|show).*(viewer|engagement|activity|analytics)/i,
    response: (ctx) => ({
      text:
        ctx.suite === "raiseroom"
          ? "Your RaiseRoom analytics show viewer engagement data. Check the 'Activity' tab in your RaiseRoom dashboard for detailed viewer stats, time-on-page, and drop-off points."
          : "You can find viewer engagement data in [Analytics](/admin/analytics). For room-specific stats, check your DataRoom or RaiseRoom dashboards.",
      followUps: [
        "Show hot leads",
        "Export analytics",
        "View pipeline",
      ],
    }),
  },
  // Pipeline / conversion
  {
    pattern: /(pipeline|conversion|funnel|leads|contacts)/i,
    response: (ctx) => {
      const base =
        "Your investor pipeline lives in [PipelineIQ](/admin/raise-crm). The pipeline view shows contacts at each stage.";
      if (ctx.tier === "FREE") {
        return {
          text: `${base}\n\n\ud83d\udca1 **Tip:** Upgrade to Pro ($29/mo) to unlock Kanban drag-and-drop, unlimited contacts, and outreach tools. [Upgrade \u2192](/admin/settings?tab=billing)`,
          followUps: [
            "Compare plans",
            "View my contacts",
            "Add a new lead",
          ],
        };
      }
      return {
        text: `${base} Use the Kanban view for a visual overview.`,
        followUps: [
          "Open Kanban view",
          "Add a new contact",
          "Check engagement scores",
        ],
      };
    },
  },
  // Compliance
  {
    pattern: /(compliance|sec|form d|accreditation|regulation)/i,
    response: (ctx) => {
      if (ctx.tier === "FREE" || ctx.tier === "CRM_PRO") {
        return {
          text: "SEC compliance features \u2014 including the compliance dashboard, Form D export, and accreditation tracking \u2014 are available on the **FundRoom** plan ($79/mo). [Upgrade \u2192](/admin/settings?tab=billing)",
          followUps: [
            "Compare plans",
            "What is Form D?",
            "Check my plan",
          ],
        };
      }
      return {
        text: "Your SEC compliance dashboard is at [Compliance](/admin/compliance). It shows your compliance score, Form D status, accreditation verification status, and audit trail integrity.",
        followUps: [
          "Export Form D",
          "Check accreditation status",
          "View audit log",
        ],
      };
    },
  },
  // Deadline / reminder
  {
    pattern: /(deadline|remind|upcoming|due|expir)/i,
    response: () => ({
      text: "Here's where to check upcoming deadlines:\n\n\u2022 **Signatures:** [SignSuite](/admin/signsuite) \u2014 check expiring envelopes\n\u2022 **Compliance:** [Compliance](/admin/compliance) \u2014 Form D filing dates\n\u2022 **Investors:** [Investors](/admin/investors) \u2014 pending approvals\n\u2022 **Transactions:** [Transactions](/admin/transactions) \u2014 pending wires",
      followUps: [
        "Check pending signatures",
        "View investor approvals",
        "Show compliance status",
      ],
    }),
  },
  // Find document
  {
    pattern: /(find|search|where|locate).*(document|file|doc)/i,
    response: () => ({
      text: "You can find documents in [DataRoom](/admin/dataroom). Use the search bar to find specific files, or browse by folder. The 'Filed Documents' tab shows all auto-filed items.",
      followUps: [
        "Upload a document",
        "Share a dataroom",
        "Check document status",
      ],
    }),
  },
  // Capital calls / distributions
  {
    pattern: /(capital call|distribution|wire|transfer|payment)/i,
    response: (ctx) => {
      if (ctx.tier === "FREE" || ctx.tier === "CRM_PRO") {
        return {
          text: "Capital calls, distributions, and wire tracking are available on the **FundRoom** plan ($79/mo). [Upgrade \u2192](/admin/settings?tab=billing)",
          followUps: [
            "Compare plans",
            "What is FundRoom?",
            "Check my plan",
          ],
        };
      }
      return {
        text: "Capital calls and distributions are managed in the Fund Management section. Navigate to [Funds](/admin/fund), select your fund, and you'll see the Capital Calls and Distributions tabs.",
        followUps: [
          "Create a capital call",
          "View distributions",
          "Check wire status",
        ],
      };
    },
  },
  // Settings / configuration
  {
    pattern: /(settings|configure|setup|notification|branding)/i,
    response: () => ({
      text: "Platform settings are organized in tabs at [Settings](/admin/settings):\n\n\u2022 **Organization** \u2014 company info & branding\n\u2022 **Fund & Investor** \u2014 fund config & compliance\n\u2022 **Team Access** \u2014 team members & roles\n\u2022 **Domain & Email** \u2014 custom domains\n\u2022 **Advanced** \u2014 API tokens & webhooks",
      followUps: [
        "Update branding",
        "Manage team members",
        "Configure email domain",
      ],
    }),
  },
  // Upgrade
  {
    pattern: /(upgrade|plan|pricing|tier|billing)/i,
    response: (ctx) => {
      if (ctx.tier === "FUNDROOM") {
        return {
          text: "You're on the FundRoom plan \u2014 our most comprehensive tier with unlimited features! Manage your subscription at [Settings > Billing](/admin/settings?tab=billing).",
          followUps: [
            "Manage subscription",
            "View usage",
            "Check invoices",
          ],
        };
      }
      if (ctx.tier === "CRM_PRO") {
        return {
          text: "You're on the Pro plan ($29/mo). Upgrade to **FundRoom** ($79/mo) for investor onboarding, wire tracking, compliance dashboards, and unlimited e-signatures. [Upgrade now \u2192](/admin/settings?tab=billing)",
          followUps: [
            "Upgrade to FundRoom",
            "Compare features",
            "View current usage",
          ],
        };
      }
      return {
        text: "You're on the Free plan. Here's what you can unlock:\n\n\u2022 **Pro** ($29/mo) \u2014 Unlimited contacts, Kanban pipeline, 25 e-sigs/mo, custom branding\n\u2022 **FundRoom** ($79/mo) \u2014 Full GP/LP platform, wire tracking, compliance, unlimited everything\n\n[Compare plans \u2192](/admin/settings?tab=billing)",
        followUps: [
          "Upgrade to Pro",
          "Upgrade to FundRoom",
          "Compare all plans",
        ],
      };
    },
  },
  // --- New intents (Prompt 6 additions) ---
  // Onboarding / getting started
  {
    pattern: /(onboard|getting started|get started|new here|first time|how to begin|walkthrough)/i,
    response: (ctx) => ({
      text:
        ctx.pathname.includes("/admin/setup")
          ? "You're already in the Setup Wizard! Complete each step to configure your organization. I'll be here if you need help along the way."
          : "Welcome! To get started, head to [Setup Wizard](/admin/setup) to configure your organization, fund, and investor onboarding settings. The wizard walks you through 9 steps:\n\n1. Company Info\n2. Branding\n3. Raise Style\n4. Team Invites\n5. Dataroom\n6. Fund Details\n7. Investor Onboarding\n8. Integrations\n9. Review & Launch",
      followUps: [
        "Take me to Setup Wizard",
        "What is a Dataroom?",
        "How do I invite investors?",
      ],
    }),
  },
  // Reports / analytics
  {
    pattern: /(report|analytics|metrics|stats|dashboard|performance|kpi)/i,
    response: (ctx) => ({
      text:
        ctx.suite === "pipelineiq"
          ? "CRM analytics are available in the PipelineIQ dashboard. Check engagement scores, conversion funnels, and outreach performance at [PipelineIQ](/admin/raise-crm)."
          : "Your reports live at [Reports](/admin/reports). You'll find key metrics, raise progress, pipeline distribution, and conversion funnels. You can also export data as CSV.",
      followUps: [
        "Export a report",
        "Show pipeline metrics",
        "View raise progress",
      ],
    }),
  },
  // Team management
  {
    pattern: /(team|member|invite|role|permission|access|colleague)/i,
    response: () => ({
      text: "Manage your team at [Settings > Team](/admin/settings?tab=teamAccess). You can:\n\n\u2022 Invite new team members by email\n\u2022 Assign roles (Owner, Admin, Manager, Member)\n\u2022 Set CRM-specific permissions (Viewer, Contributor, Manager)\n\u2022 Remove team members",
      followUps: [
        "Invite a team member",
        "Change someone's role",
        "View team members",
      ],
    }),
  },
  // Data export / import
  {
    pattern: /(export|import|download|csv|data migration|bulk)/i,
    response: () => ({
      text: "Data management tools are in [Settings > Advanced](/admin/settings?tab=advanced):\n\n\u2022 **Export** \u2014 Download investors, contacts, transactions, and more as CSV or JSON\n\u2022 **Import** \u2014 Bulk import contacts or investors via CSV\n\u2022 **Reports** \u2014 Export pipeline and compliance reports at [Reports](/admin/reports)",
      followUps: [
        "Export investors CSV",
        "Import contacts",
        "Export Form D data",
      ],
    }),
  },
  // What's new / changelog
  {
    pattern: /(what's new|changelog|update|release|new feature|latest)/i,
    response: () => ({
      text: "FundRoom is constantly improving! Recent highlights include:\n\n\u2022 SignSuite bulk send \u2014 send documents to multiple recipients at once\n\u2022 DataRoom NDA gate \u2014 require e-signed NDAs before viewing\n\u2022 CRM engagement scoring \u2014 auto-classify leads as Hot/Warm/Cool\n\u2022 Form D export \u2014 SEC-compliant data export for filing\n\nStay tuned for more updates!",
      followUps: [
        "Tell me about SignSuite",
        "What is engagement scoring?",
        "How does Form D export work?",
      ],
    }),
  },
  // Investor management
  {
    pattern: /(investor|lp|limited partner|add investor|invite investor)/i,
    response: (ctx) => ({
      text:
        ctx.tier === "FREE" || ctx.tier === "CRM_PRO"
          ? "Investor management and investor onboarding require the **FundRoom** plan ($79/mo). On FundRoom, you can add investors manually, invite via email, bulk import, and run a full investor onboarding wizard. [Upgrade \u2192](/admin/settings?tab=billing)"
          : "Manage your investors at [Investors](/admin/investors). You can:\n\n\u2022 View the investor pipeline (7 stages)\n\u2022 [Add investors manually](/admin/investors/new)\n\u2022 [Bulk import via CSV](/admin/investors/import)\n\u2022 Review and approve investor applications\n\u2022 Track wire receipts and document status",
      followUps: [
        "Add an investor manually",
        "Bulk import investors",
        "View investor pipeline",
      ],
    }),
  },
];

function detectIntentResponse(
  message: string,
  context: ChatContext,
): IntentResponse {
  for (const intent of INTENTS) {
    if (intent.pattern.test(message)) {
      const result =
        typeof intent.response === "function"
          ? intent.response(context)
          : intent.response;
      // Normalize plain string responses to IntentResponse
      if (typeof result === "string") {
        return { text: result };
      }
      return result;
    }
  }

  // Fallback response with contextual link and pathname-based suggestions
  const suiteLinks: Record<string, string> = {
    raiseroom: "[RaiseRoom](/admin/raiseroom)",
    signsuite: "[SignSuite](/admin/signsuite)",
    pipelineiq: "[PipelineIQ](/admin/raise-crm)",
    dataroom: "[DataRoom](/admin/dataroom)",
    fundroom: "[Dashboard](/admin/dashboard)",
  };

  const currentLink = suiteLinks[context.suite] || suiteLinks.fundroom;

  // Context-aware fallback suggestions based on current pathname
  let followUps: string[] = [
    "What can you help me with?",
    "Show me my pipeline",
    "Check pending actions",
  ];

  if (context.pathname.includes("/investors")) {
    followUps = [
      "Add an investor",
      "Check pending approvals",
      "Export investor data",
    ];
  } else if (context.pathname.includes("/signsuite")) {
    followUps = [
      "Send a new envelope",
      "Check pending signatures",
      "View templates",
    ];
  } else if (context.pathname.includes("/dataroom")) {
    followUps = [
      "Upload a document",
      "Share a link",
      "Check viewer activity",
    ];
  } else if (context.pathname.includes("/raise-crm")) {
    followUps = [
      "Add a contact",
      "Draft an outreach email",
      "Check engagement scores",
    ];
  } else if (context.pathname.includes("/fund")) {
    followUps = [
      "Check wire status",
      "View distributions",
      "Export Form D",
    ];
  } else if (context.pathname.includes("/settings")) {
    followUps = [
      "Update branding",
      "Manage team",
      "Configure email domain",
    ];
  }

  return {
    text: `I'll be able to help with that soon! For now, here's where you can find what you need: ${currentLink}\n\nYou can also check [Settings](/admin/settings) or use the sidebar to navigate to any module.`,
    followUps,
  };
}

// ---------------------------------------------------------------------------
// POST /api/lara/chat
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { message, context } = body as {
      message?: string;
      context?: ChatContext;
    };

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 },
      );
    }

    const chatContext: ChatContext = {
      suite: context?.suite || "fundroom",
      page: context?.page || "general",
      pathname: context?.pathname || "/admin/dashboard",
      tier: context?.tier || "FREE",
    };

    // v1: Intent-based canned responses
    const result = detectIntentResponse(message.trim(), chatContext);

    return NextResponse.json({
      response: result.text,
      followUps: result.followUps,
    });
  } catch (error) {
    reportError(error as Error, {
      path: "/api/lara/chat",
      action: "lara_chat",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
