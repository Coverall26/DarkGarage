# Lara AI — Specification & Architecture

> **Version:** 1.0 (March 2, 2026)
> **Status:** V1 Production (Intent-Based), V2 Planned (Claude API + RAG)
> **Owner:** FundRoom AI Engineering

---

## 1. Overview

Lara is FundRoom's AI concierge — a persistent chat widget accessible on every admin page. She helps GPs navigate the platform, draft outreach, check pipeline status, and surface contextual actions based on the user's current location and subscription tier.

**Product Positioning:**
- **Suite:** Lara AI (branded purple `#8B5CF6`)
- **Location:** Bottom-right FAB (56px circle) on all admin pages, expanding to 380×500 panel on desktop, full-screen on mobile
- **Availability:** All tiers (FREE, CRM_PRO, FUNDROOM) with tier-gated features

---

## 2. Architecture

### 2.1 V1 — Intent-Based (Current, Production)

```
User types message → POST /api/lara/chat →
  detectIntentResponse(message, context) →
    Regex pattern matching against 18 intents →
    Context-aware response (suite, page, pathname, tier) →
    Returns { text, followUps } →
  Client renders response + follow-up suggestion pills
```

**Key Files:**

| File | Lines | Purpose |
|------|-------|---------|
| `components/lara/lara-chat.tsx` | 597 | Client-side chat widget (FAB, panel, messages, follow-ups, persistence) |
| `app/api/lara/chat/route.ts` | 464 | API route with intent detection, context handling, response generation |

**V1 Characteristics:**
- Zero external API calls (no LLM cost)
- Sub-50ms response time (regex matching only)
- 18 intent patterns with context-aware responses
- Tier-gated suggestions (FREE gets 2 follow-ups, paid gets 3)
- Session persistence via `sessionStorage`

### 2.2 V2 — Claude API + RAG (Planned, Phase 2)

```
User types message → POST /api/lara/chat →
  Check conversation memory (last N messages) →
  Build RAG context (fund data, pipeline stats, recent activity) →
  Construct system prompt + user message →
  Claude API (claude-haiku or claude-sonnet) →
  Stream response to client (SSE) →
  Store conversation turn in DB
```

**V2 Additions (not yet built):**
- Claude API integration via Anthropic SDK
- RAG context injection (fund metrics, pipeline data, recent views)
- Streaming responses via SSE
- Persistent conversation history (database-backed, per-user per-org)
- Action execution (create envelope, send email, add contact)
- Document Q&A (upload PDF, ask questions — FUNDROOM tier only)

---

## 3. Intent System (V1)

### 3.1 Intent Definition

Each intent is defined as:
```typescript
interface Intent {
  pattern: RegExp;          // Regex to match user input
  response: string |        // Static response OR
    ((ctx: ChatContext) =>   // Context-aware function returning
      IntentResponse | string);  // { text, followUps? }
}

interface IntentResponse {
  text: string;             // Markdown-formatted response
  followUps?: string[];     // Up to 3 clickable suggestion pills
}
```

### 3.2 Context Object

```typescript
interface ChatContext {
  suite: string;    // Active suite: "raiseroom" | "signsuite" | "raisecrm" | "dataroom" | "fundroom"
  page: string;     // Page category: "dashboard" | "signsuite" | "raiseroom" | etc.
  pathname: string; // Full URL pathname (e.g., "/admin/investors")
  tier: string;     // Subscription tier: "FREE" | "CRM_PRO" | "FUNDROOM"
}
```

### 3.3 Intent Catalog (18 Intents)

| # | Category | Pattern | Context-Aware | Tier-Gated | Follow-Ups |
|---|----------|---------|---------------|------------|------------|
| 1 | Greeting | `/^(hi\|hello\|hey\|howdy)/i` | No | No | 3 |
| 2 | Capabilities | `/(what can you\|help me)/i` | No | No | 3 |
| 3 | Email Draft | `/(draft\|write).*(email\|outreach)/i` | Yes (suite) | No | 3 |
| 4 | Signatures | `/(check\|pending).*(signature\|signing)/i` | No | No | 3 |
| 5 | Engagement | `/(summarize\|check).*(viewer\|engagement)/i` | Yes (suite) | No | 3 |
| 6 | Pipeline | `/(pipeline\|conversion\|funnel\|leads)/i` | Yes (tier) | Yes | 3 |
| 7 | Compliance | `/(compliance\|sec\|form d)/i` | Yes (tier) | Yes | 3 |
| 8 | Deadlines | `/(deadline\|remind\|upcoming\|due)/i` | No | No | 3 |
| 9 | Find Document | `/(find\|search).*(document\|file)/i` | No | No | 3 |
| 10 | Capital/Wire | `/(capital call\|distribution\|wire)/i` | Yes (tier) | Yes | 3 |
| 11 | Settings | `/(settings\|configure\|setup)/i` | No | No | 3 |
| 12 | Upgrade | `/(upgrade\|plan\|pricing\|tier)/i` | Yes (tier) | Yes | 3 |
| 13 | Onboarding | `/(onboard\|getting started\|how to begin)/i` | Yes (pathname) | No | 3 |
| 14 | Reports | `/(report\|analytics\|metrics\|stats)/i` | Yes (suite) | No | 3 |
| 15 | Team | `/(team\|member\|invite\|role)/i` | No | No | 3 |
| 16 | Data Export | `/(export\|import\|download\|csv)/i` | No | No | 3 |
| 17 | Changelog | `/(what's new\|changelog\|update)/i` | No | No | 3 |
| 18 | Investors | `/(investor\|lp\|limited partner)/i` | Yes (tier) | Yes | 3 |

### 3.4 Fallback Behavior

When no intent matches, Lara returns a contextual fallback with:
- Generic help text with link to the active suite
- Pathname-based follow-up suggestions:
  - `/investors` → Add investor, Check approvals, Export data
  - `/signsuite` → New envelope, Pending signatures, Templates
  - `/dataroom` → Upload document, Share link, Viewer activity
  - `/raise-crm` → Add contact, Draft email, Engagement scores
  - `/fund` → Wire status, Distributions, Form D
  - `/settings` → Branding, Team, Email domain
  - Default → Capabilities, Pipeline, Pending actions

---

## 4. Client Component (`lara-chat.tsx`)

### 4.1 State Management

| State | Type | Purpose |
|-------|------|---------|
| `isOpen` | boolean | Panel visibility |
| `messages` | ChatMessage[] | Conversation history (initialized from sessionStorage) |
| `input` | string | Current input field value |
| `isLoading` | boolean | API request in flight |
| `hasShownGreeting` | boolean | Prevents duplicate greetings on re-open |

### 4.2 Persistence

- **Storage:** `sessionStorage` (key: `"lara-chat-messages"`)
- **Lifecycle:** Persists across page navigations within the same browser tab. Cleared on tab close.
- **Initialization:** `loadPersistedMessages()` called in `useState` initializer
- **Sync:** `persistMessages()` called in `useEffect` on every `messages` update
- **Error handling:** Silently ignores `sessionStorage` quota errors

### 4.3 Accessibility (WCAG 2.1 AA)

| Feature | Implementation |
|---------|---------------|
| FAB button | `aria-label` (dynamic open/close), `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"` |
| Chat panel | `role="dialog"`, `aria-modal="true"`, `aria-label="Lara AI assistant"` |
| Message area | `role="log"`, `aria-live="polite"`, `aria-label="Chat messages"` |
| Typing indicator | `role="status"`, `aria-label="Lara is typing"` |
| Input field | `<label htmlFor="lara-chat-input" className="sr-only">` |
| Send button | `aria-label="Send message"` |
| Decorative icons | `aria-hidden="true"` on all Lucide icons |
| Focus management | `fabRef` receives focus on panel close via `setTimeout(() => fabRef.current?.focus(), 50)` |
| Keyboard | Escape closes panel, Enter sends message |
| Touch targets | All interactive elements ≥44px (`min-h-[44px]`) on mobile |

### 4.4 Context Detection

`getSuiteContext(pathname)` maps the current URL to a suite context:

| Pathname Prefix | Suite | Greeting Theme |
|----------------|-------|---------------|
| `/admin/dashboard` | fundroom | General management |
| `/admin/signsuite` | signsuite | Signature & documents |
| `/admin/raiseroom`, `/admin/fund` | raiseroom | Capital raise |
| `/admin/raise-crm`, `/admin/outreach` | raisecrm | CRM & outreach |
| `/admin/dataroom`, `/datarooms` | dataroom | Document management |
| `/admin/investors`, `/admin/approvals` | fundroom | Fund operations |
| `/admin/analytics`, `/admin/reports` | fundroom | Analytics |
| `/admin/settings` | fundroom | Configuration |
| Default | fundroom | General help |

### 4.5 Tier-Based Feature Gating

| Feature | FREE | CRM_PRO | FUNDROOM |
|---------|------|---------|----------|
| Quick actions shown | 2 | 3 | 3 |
| Follow-up suggestions | 2 | 3 | 3 |
| Attach file button | Hidden | Visible (disabled) | Visible (enabled) |
| "Upgrade for more" link | Shown | Hidden | Hidden |
| Compliance intent | Upgrade prompt | Upgrade prompt | Full response |
| Capital call intent | Upgrade prompt | Upgrade prompt | Full response |
| Pipeline Kanban mention | Upgrade prompt | Full response | Full response |
| Investor management | Upgrade prompt | Upgrade prompt | Full response |

### 4.6 Follow-Up Suggestions

After each Lara response, the most recent `followUps` array is rendered as clickable pills below the message area. Clicking a pill calls `handleSend(action)` which sends the text as if the user typed it.

- Rendered between the message log and the input area
- Only shown when `messages.length > 1` (not on initial greeting)
- Hidden during loading state
- Styled as rounded pills with purple accent (`border-[#8B5CF6]/20`)

### 4.7 Disclaimer Footer

A fixed footer at the bottom of the panel:
```
⚠ Lara is an AI assistant. Not investment, legal, or tax advice.
```
- ShieldAlert icon (Lucide), `aria-hidden="true"`
- `text-xs text-muted-foreground/60`

---

## 5. API Route (`/api/lara/chat`)

### 5.1 Request

```typescript
POST /api/lara/chat
Content-Type: application/json
Authorization: NextAuth session cookie

{
  "message": "string (required, max 2000 chars)",
  "context": {
    "suite": "string",
    "page": "string",
    "pathname": "string",
    "tier": "string"
  }
}
```

### 5.2 Response

```typescript
// Success (200)
{
  "response": "string (markdown-formatted)",
  "followUps": ["string", "string", "string"]
}

// Error (400)
{ "error": "Message is required" }
{ "error": "Message too long (max 2000 characters)" }

// Error (401)
{ "error": "Unauthorized" }

// Error (500)
{ "error": "Internal server error" }
```

### 5.3 Security

- **Authentication:** `getServerSession(authOptions)` — requires active NextAuth session
- **Input validation:** Message required, non-empty, max 2000 characters
- **Error handling:** `reportError()` in catch block → Rollbar
- **No PII logging:** Messages are not persisted server-side in V1
- **Rate limiting:** Inherits blanket 200 req/min/IP from proxy.ts middleware

---

## 6. Phase 2 Upgrade Roadmap

### 6.1 Claude API Integration

```typescript
// Planned: lib/lara/claude-client.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function chat(messages: Message[], context: RAGContext): Promise<Stream> {
  return client.messages.stream({
    model: "claude-haiku-4-5-20251001", // Fast, low-cost
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages,
  });
}
```

### 6.2 RAG Context Sources

| Source | Data | Injection Method |
|--------|------|-----------------|
| Fund metrics | Committed, funded, target, IRR | Prisma query → system prompt |
| Pipeline stats | Stage counts, conversion rates | Prisma query → system prompt |
| Recent activity | Last 10 audit log entries | Prisma query → system prompt |
| Viewer engagement | Hot/Warm/Cool lead counts | Prisma query → system prompt |
| Document status | Pending signatures, reviews | Prisma query → system prompt |
| User profile | Name, role, team, subscription | Session → system prompt |

### 6.3 Action Execution (V2)

| Action | Trigger | Implementation |
|--------|---------|---------------|
| Create envelope | "Send [doc] to [email]" | POST /api/esign/envelopes |
| Draft email | "Write an update to investors" | POST /api/ai/draft-email |
| Add contact | "Add [name] as a lead" | POST /api/contacts |
| Export report | "Generate Form D data" | GET /api/admin/reports/form-d |
| Check status | "What's my raise progress?" | GET fund aggregate data |

### 6.4 Conversation Persistence (V2)

```sql
-- Planned Prisma model
model LaraConversation {
  id        String   @id @default(cuid())
  userId    String
  orgId     String
  messages  Json     // Array of { role, content, timestamp }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User         @relation(fields: [userId], references: [id])
  org  Organization @relation(fields: [orgId], references: [id])

  @@index([userId, orgId])
  @@index([updatedAt])
}
```

### 6.5 Safety & Rate Limits (V2)

| Control | Implementation |
|---------|---------------|
| Token limit | 1024 max_tokens per response |
| Message limit | 50 messages per conversation |
| Rate limit | 20 requests/minute per user (tighter than blanket) |
| Content filter | System prompt instructs: no investment advice, no legal advice, no tax advice |
| PII handling | Strip SSN/EIN from context before injection |
| Cost control | Use claude-haiku for most queries, claude-sonnet for complex analysis (FUNDROOM only) |
| Audit trail | Log all actions executed by Lara to audit log |

---

## 7. Testing

### 7.1 Current Coverage

The Lara chat system is tested via:
- **API route smoke tests:** Auth enforcement, input validation, response shape
- **Integration tests:** Intent detection, context-aware responses, tier gating
- **Manual testing:** FAB interaction, panel open/close, follow-up pills, persistence

### 7.2 Recommended Test Expansion (V2)

- Intent matching accuracy tests (18 patterns × positive + negative cases)
- Follow-up suggestion rendering tests
- SessionStorage persistence/restoration tests
- Accessibility audit (axe-core automated scan)
- Claude API mock tests (response streaming, error handling)
- RAG context injection tests (correct data passed to system prompt)
- Action execution tests (envelope creation, email drafting)

---

## 8. Design Tokens

| Element | Value | Notes |
|---------|-------|-------|
| Brand color | `#8B5CF6` (Purple) | FAB, header gradient, follow-up pills |
| Hover color | `#7C3AED` | Darker purple on hover |
| User bubble | `#2563EB` (Electric Blue) | User message background |
| Lara bubble | `#8B5CF6` at 10% opacity | Lara message background |
| Panel width | 380px (desktop) | Full-screen on mobile |
| Panel height | 500px (desktop) | Full-screen on mobile |
| FAB size | 56px (h-14 w-14) | Bottom-right, z-50 |
| Touch targets | ≥44px | All interactive elements on mobile |
| Font | 14px (text-sm) | Messages |
| Timestamp | 12px (text-xs) | Message timestamps |
| Follow-up pills | 12px (text-xs) | Rounded-full, min-h-[32px] |
