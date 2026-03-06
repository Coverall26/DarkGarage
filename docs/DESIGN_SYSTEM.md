# FundRoom AI — Design System Reference

> Centralized design system documentation. Source of truth for colors, typography, spacing, components, animations, and dark mode strategy.

## Brand Colors

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Deep Navy | `#0A1628` | Backgrounds, headers, navigation |
| Navy Card | `#111827` | Card backgrounds (dark mode) |
| Navy Light | `#1E293B` | Elevated surfaces (dark mode) |
| Electric Blue | `#0066FF` | Primary CTAs, links, active states |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Success | `#10B981` | Positive actions, confirmations |
| Warning | `#F59E0B` | Caution states, pending items |
| Error | `#EF4444` | Destructive actions, failures |
| Info | `#06B6D4` | Informational elements |
| Purple | `#8B5CF6` | FundRoom brand accent |

### Suite Colors

Each product module has a dedicated color used in sidebar active states, tab highlights, primary buttons, and icon accents.

| Suite | Hex | CSS Active Pattern |
|-------|-----|--------------------|
| RaiseRoom | `#06B6D4` (Cyan) | `text: hex`, `border-left: 2px solid hex`, `bg: hex + "1A"` (10%) |
| SignSuite | `#10B981` (Emerald) | Same pattern |
| RaiseCRM | `#F59E0B` (Amber) | Same pattern |
| DataRoom | `#2563EB` (Blue) | Same pattern |
| FundRoom | `#8B5CF6` (Purple) | Same pattern |
| Lara AI | `#8B5CF6` (Purple) | Same pattern |

### Background & Surface Colors

| Token | Light | Dark |
|-------|-------|------|
| Page Background | `#F3F4F6` | `#0A1628` |
| Card Background | `#FFFFFF` | `#111827` |
| Border | `#E5E7EB` | `#1F2937` |

### Text Colors

| Token | Light | Dark |
|-------|-------|------|
| Primary | `#1F2937` | `#E2E8F0` |
| Secondary | `#6B7280` | `#94A3B8` |
| Muted | `#9CA3AF` | `#64748B` |

### Domain-Specific Color Maps

**Investor Pipeline Stages:**
`applied: #6B7280` → `underReview: #F59E0B` → `approved: #3B82F6` → `committed: #8B5CF6` → `docsApproved: #06B6D4` → `funded: #10B981` → `rejected: #EF4444`

**Distribution Types:**
`returnOfCapital: #3B82F6` | `profit: #10B981` | `dividend: #8B5CF6` | `other: #6B7280`

**Fund Status:**
`active: #10B981` | `closed: #6B7280` | `raising: #3B82F6` | `winding: #F59E0B`

**CRM Tiers:**
`free: #6B7280` | `crmPro: #3B82F6` | `fundroom: #8B5CF6` | `aiCrm: #06B6D4`

**Engagement Tiers:**
`hot: red-100/700` | `warm: amber-100/700` | `cool: blue-100/700` | `none: gray-100/500`

**Chart Colors (Recharts/Tremor):**
`#2563EB`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#EF4444`, `#06B6D4`, `#EC4899`, `#14B8A6`

---

## Typography

### Font Families

| Role | Family | Stack | Tailwind Class |
|------|--------|-------|----------------|
| Primary | Inter | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Default (body) |
| Monospace | JetBrains Mono | `'JetBrains Mono', 'DM Mono', ui-monospace, SFMono-Regular, monospace` | `font-mono` |
| Marketing | Fraunces | `'Fraunces', Georgia, 'Times New Roman', serif` | `font-marketing` (if configured) |

**Financial Data Rule:** All monetary amounts, percentages, dates, and counts MUST use `font-mono tabular-nums` for consistent column alignment.

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| xs | 0.75rem (12px) | Badges, captions |
| sm | 0.875rem (14px) | Body small, table cells |
| base | 1rem (16px) | Body text (mobile inputs must be 16px to prevent iOS zoom) |
| lg | 1.125rem (18px) | Subheadings |
| xl | 1.25rem (20px) | Section headers |
| 2xl | 1.5rem (24px) | Page subtitles |
| 3xl | 1.875rem (30px) | Page titles |
| 4xl | 2.25rem (36px) | Hero headings |

### Font Weights

`regular: 400` | `medium: 500` | `semibold: 600` | `bold: 700`

### Line Heights

`tight: 1.25` | `normal: 1.5` | `relaxed: 1.625`

---

## Spacing

Follows a 4px base unit scale:

| Token | Value | Pixels |
|-------|-------|--------|
| 0.5 | 0.125rem | 2px |
| 1 | 0.25rem | 4px |
| 1.5 | 0.375rem | 6px |
| 2 | 0.5rem | 8px |
| 3 | 0.75rem | 12px |
| 4 | 1rem | 16px |
| 5 | 1.25rem | 20px |
| 6 | 1.5rem | 24px |
| 8 | 2rem | 32px |
| 10 | 2.5rem | 40px |
| 12 | 3rem | 48px |
| 16 | 4rem | 64px |
| 20 | 5rem | 80px |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 6px | Form inputs |
| DEFAULT / md | 8px (`--radius`) | Cards, containers |
| lg | 10px | Large cards |
| xl | 12px | Modals |
| full | 9999px | Pills, badges, avatars |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| sm | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtle elements |
| DEFAULT | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | Cards |
| md | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | Dropdowns |
| lg | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Modals |
| hover | `0 8px 25px -5px rgb(0 0 0 / 0.15)` | Card hover states |
| card | `0 1px 3px 0 rgb(0 0 0 / 0.06)` | Flat card style |

---

## Breakpoints

| Token | Width | Behavior |
|-------|-------|----------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet — sidebar collapses to icon-only |
| lg | 1024px | Desktop — full sidebar |
| xl | 1280px | Wide desktop |
| 2xl | 1440px | Max content width (`max-w-[1440px]`) |

---

## Z-Index Layers

| Layer | Value | Usage |
|-------|-------|-------|
| overlay | 30 | Overlays, backdrops |
| sticky | 40 | Sticky headers |
| fab | 40 | Floating action buttons |
| dropdown | 50 | Dropdowns, selects |
| modal | 50 | Modals, dialogs |
| popover | 50 | Popovers |
| tooltip | 50 | Tooltips |
| toast | 100 | Toast notifications (Sonner) |

---

## Touch Targets (WCAG 2.1 AA)

| Target | Min Size |
|--------|----------|
| minimum | 44px |
| button | 44px |
| navItem | 48px |
| listItem | 56px |

All interactive elements must meet the 44px minimum. Mobile inputs use `text-base` (16px) to prevent iOS auto-zoom.

---

## CSS Custom Properties (HSL Theme System)

The platform uses shadcn/ui's HSL-based theming via CSS custom properties in `styles/globals.css`.

### Light Mode (`:root`)

```css
--background: 0 0% 100%;          /* white */
--foreground: 240 10% 3.9%;       /* gray-950 */
--primary: 240 5.9% 10%;          /* gray-900 */
--secondary: 240 4.8% 95.9%;      /* gray-100 */
--destructive: 0 84.2% 60.2%;     /* red-500 */
--warning: 38 92% 50%;            /* amber-500 */
--muted: 240 4.8% 95.9%;
--accent: 240 4.8% 95.9%;
--radius: 0.5rem;
```

### Dark Mode (`.dark`)

All custom properties are overridden for dark backgrounds — Deep Navy palette.

### Sidebar Variables

`--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` — used by the admin sidebar component.

---

## Animation System

### Dual-Layer Architecture

1. **globals.css** — Complex keyframes for page-level animations
2. **tailwind.config.js** — Utility-level keyframes for component animations

### globals.css Keyframes

| Animation | Duration | Usage |
|-----------|----------|-------|
| `fadeInUp` | 0.4s ease-out | Page entrance |
| `scaleIn` | 0.2s ease-out | Modal appearance |
| `fadeIn` | 0.3s ease-out | General fade |
| `slideInRight` | 0.3s ease-out | Panel slides |
| `shimmer` | 2s infinite | Skeleton loading |
| `successCheck` | 0.4s ease-out | Completion checkmarks |
| `confettiBurst` | 0.6s ease-out | Celebration effects |

### Tailwind Keyframes

`scale-in`, `fade-in`, `gauge_fadeIn`, `gauge_fill`, `flyEmoji`, `accordion-down`, `accordion-up`, `caret-blink`

### Utility Classes

| Class | Effect |
|-------|--------|
| `.animate-fade-in` | Fade in 0.3s |
| `.animate-fade-in-up` | Slide up + fade 0.4s |
| `.animate-scale-in` | Scale from 95% 0.2s |
| `.stagger-1` through `.stagger-4` | Sequential animation delays (0.1s increments) |
| `.card-hover-lift` | Translatey -2px + shadow on hover |
| `.progress-bar-animated` | Right-to-left gradient sweep |
| `.btn-press` | Scale down on active |
| `.page-transition` | Opacity + translateY entrance |
| `.skeleton-shimmer` | Loading shimmer effect |
| `.tabular-nums` | Monospace number alignment |

### Reduced Motion

Full `prefers-reduced-motion: reduce` support:
- Global rule in `globals.css` disables all animations and transitions
- CSS module-specific overrides for loading indicators
- Respects system accessibility settings

---

## Component Library

### Foundation (shadcn/ui based — 74 components)

Located in `components/ui/`. Key categories:

**Layout:** `card`, `separator`, `scroll-area`, `collapsible`, `resizable`, `sheet`, `sidebar`

**Forms:** `button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`, `form`, `label`, `phone-input`, `smart-date-time-picker`

**Data Display:** `table`, `data-table`, `badge`, `avatar`, `progress`, `gauge`, `metric-card`, `pipeline-bar`

**Feedback:** `alert`, `alert-dialog`, `dialog`, `confirm-dialog`, `drawer`, `sonner` (toasts), `tooltip`, `popover`

**Navigation:** `breadcrumb`, `tabs`, `navigation-menu`, `command`, `pagination`, `dropdown-menu`, `context-menu`, `menubar`

**Domain-Specific:** `status-badge`, `encryption-badge`, `feature-preview`, `upgrade-button`, `action-queue`, `wizard`, `empty-state`, `upload-zone`

### Status Badge Classes

Gold standard pattern: `bg-{color}-100 text-{color}-700 dark:bg-{color}-900/30 dark:text-{color}-400`

Comprehensive classes defined in `lib/design-tokens.ts` under `statusBadgeClasses` for:
- Envelope/signing statuses (9 states)
- Investor pipeline stages (7 states)
- Funding statuses (4 states)
- Document review statuses (4 states)
- Upload source badges (2 types)
- Engagement tiers (4 levels with borders)
- Recipient statuses (6 states)

---

## Dark Mode Strategy

- **Mechanism:** Class-based (`darkMode: ["class"]` in Tailwind config)
- **Toggle:** Applied via `.dark` class on root element
- **GP Admin:** Light backgrounds (gray-50/white cards)
- **LP Portal:** Dark gradient background (`from-gray-900 via-gray-800 to-gray-900`) — intentional design choice
- **Pattern:** All components use Tailwind `dark:` variant classes
- **Audit:** 26 LP/onboarding components verified for dark mode consistency

---

## Tremor Charting Integration

Tailwind config includes Tremor-specific extensions:

- **Colors:** `tremor.brand` (blue palette), `tremor.background` (gray), `tremor.border`, `tremor.ring`, `tremor.content` — each with light and dark variants
- **Shadows:** `tremor-input`, `tremor-card`, `tremor-dropdown`
- **Font Sizes:** `tremor-label` (xs), `tremor-default` (sm), `tremor-title` (lg), `tremor-metric` (2xl)
- **Border Radius:** `tremor-small` (sm), `tremor-default` (md), `tremor-full` (full)
- **Safelist:** Dynamic Tremor utility classes safelisted for runtime color generation

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/design-tokens.ts` | TypeScript constants for programmatic access |
| `styles/globals.css` | CSS custom properties (HSL) + keyframe animations |
| `tailwind.config.js` | Tailwind theme extensions, plugins, safelist |
| `docs/FundRoom_Brand_Guidelines.md` | Brand identity, voice, UX philosophy |
| `app/layout.tsx` | Font loading (Inter via Google Fonts) |
| `components/ui/` | 74 shadcn/ui-based components |

---

## Accessibility (WCAG 2.1 AA)

All 74 UI components in `components/ui/` have been audited and hardened for WCAG 2.1 AA compliance. 28 components received fixes; the remaining components already met requirements.

### Touch Target Patterns

Three patterns are used to meet the 44px minimum touch target requirement:

| Pattern | Implementation | Use Case |
|---------|---------------|----------|
| **Direct height increase** | `h-11` (44px) or `min-h-[44px]` | Buttons, inputs, selects, toggles, tabs, menu items |
| **Flex container** | `flex h-11 w-11 items-center justify-center` | Icon-only buttons (dialog close, sheet close, alert close) |
| **Pseudo-element expansion** | `relative before:absolute before:-inset-[Npx] before:content-['']` | Small visual elements (checkbox, switch, radio, slider thumb, small icon buttons) |

### Components Fixed (28 total)

**Form Controls:** `button` (h-11 default, h-10 sm, h-12 lg, h-11 w-11 icon), `input` (h-11, text-base, ring-2 focus), `textarea` (text-base, ring-2 focus), `select` (h-11, text-base, ring-2 focus), `checkbox` (pseudo -10px), `switch` (pseudo -10px), `radio-group` (pseudo -14px), `slider` (thumb pseudo -10px), `toggle` (h-11 default)

**Overlays:** `dialog` (close h-11 w-11), `sheet` (close h-11 w-11), `alert` (close h-11 w-11), `drawer` (inherits dialog)

**Navigation:** `tabs` (min-h-[44px]), `dropdown-menu` (min-h-[44px] items), `pagination` (h-11 w-11 ellipsis), `breadcrumb` (h-11 w-11 ellipsis), `accordion` (min-h-[44px], ring-2 focus), `command` (min-h-[44px] items)

**Specialized:** `phone-input` (h-11 country select), `input-otp` (h-11 w-11 slots), `copy-button` (min-h/w-[44px]), `data-table` (text-base search, h-10 w-10 pagination), `smart-date-time-picker` (text-base, min-h/w-[44px] icon), `carousel` (h-11 w-11 nav buttons), `upload-zone` (pseudo -6px clear button), `rich-text-editor` (aria-labels + aria-pressed on all 8 toolbar buttons)

**Layout:** `sidebar` (SidebarTrigger h-8, kept for compact sidebar density), `calendar` (nav buttons h-8, kept for date grid density)

### Focus Indicators

All interactive components use `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` for keyboard focus visibility. The `focus-visible` pseudo-class ensures focus rings only appear for keyboard navigation, not mouse clicks.

### ARIA Attributes

| Pattern | Usage |
|---------|-------|
| `aria-label` | Icon-only buttons (close, remove, toolbar actions), upload zones, search inputs |
| `aria-pressed` | Toggle buttons (rich text toolbar: Bold, Italic, lists, blockquote) |
| `aria-hidden="true"` | Decorative icons (Lucide icons next to text labels), visual dividers, hidden file inputs |
| `aria-current="step"` | Active wizard step indicators |
| `role="alert"` | Error messages (form validation, upload errors) |
| `role="button"` | Non-button clickable elements (upload zone div) |
| `aria-busy` | Buttons in loading state |

### iOS Zoom Prevention

All text inputs use `text-base sm:text-sm` — renders at 16px on mobile (prevents iOS Safari auto-zoom on input focus) and 14px on desktop. Applied to: `input`, `textarea`, `select`, `data-table` search, `smart-date-time-picker`.

### Reduced Motion

Full `prefers-reduced-motion: reduce` support via global rule in `globals.css` that disables all animations and transitions. CSS module-specific overrides preserve loading indicators (dots, spinners) with reduced visual motion.

### Keyboard Navigation

- Upload zone: `tabIndex={0}`, Enter/Space triggers file picker, disabled state removes from tab order (`tabIndex={-1}`)
- Accordion: `focus-visible:ring-2` on trigger
- All buttons: native `<button>` elements with proper disabled states
- Carousel: Previous/Next buttons with keyboard support

---

## Component Patterns

### Loading States

Three loading patterns used across the platform:

| Pattern | Component | Usage |
|---------|-----------|-------|
| **Skeleton** | `animate-pulse` blocks | Page loads, data fetching (GP dashboard, LP dashboard, reports, approvals) |
| **Spinner** | `loading-spinner.module.css` | Inline loading (button submit, form save) |
| **Dots** | `loading-dots.module.css` | Chat typing indicator (Lara AI), processing states |

**Skeleton pattern:**
```tsx
<div className="animate-pulse space-y-4">
  <div className="h-8 bg-muted rounded w-1/3" />  {/* Title */}
  <div className="h-4 bg-muted rounded w-2/3" />  {/* Subtitle */}
  <div className="grid grid-cols-3 gap-4">
    <div className="h-24 bg-muted rounded" />       {/* Stat card */}
    <div className="h-24 bg-muted rounded" />
    <div className="h-24 bg-muted rounded" />
  </div>
</div>
```

### Button Matrix

| Variant | Class | Usage |
|---------|-------|-------|
| Primary | `bg-[#0066FF] text-white hover:bg-[#0052CC]` | Main CTA (one per section) |
| Secondary | `bg-secondary text-secondary-foreground` | Supporting actions |
| Outline | `border border-input bg-background` | Tertiary actions, filters |
| Ghost | `hover:bg-accent` | Icon buttons, nav items |
| Destructive | `bg-destructive text-destructive-foreground` | Delete, void, reject |
| Link | `text-primary underline-offset-4 hover:underline` | Inline text actions |

**Size variants:** `sm` (h-10, text-xs), `default` (h-11, text-sm), `lg` (h-12, text-base), `icon` (h-11 w-11).

**Loading state:** Disable button + show spinner icon + change label (e.g., "Save" → "Saving...").

### Form Validation Patterns

| Pattern | Implementation |
|---------|---------------|
| **Inline errors** | Red `text-destructive text-sm` below input, `role="alert"` for screen readers |
| **Field highlight** | `border-destructive` + `ring-destructive` on invalid inputs |
| **Required indicator** | Red asterisk `*` next to label, or "Required" in `text-muted-foreground text-xs` |
| **Success feedback** | Green checkmark icon next to validated fields (email format, tax ID format) |
| **Disabled submit** | Button disabled until all required fields valid — never hide the button |

**Zod + React pattern:**
```tsx
const [errors, setErrors] = useState<Record<string, string>>({});
// On submit: schema.safeParse() → set errors → render per-field messages
{errors.email && <p className="text-destructive text-sm mt-1" role="alert">{errors.email}</p>}
```

### Modal / Dialog Patterns

| Pattern | Component | Behavior |
|---------|-----------|----------|
| **Confirmation** | `confirm-dialog.tsx` | Destructive action guard — title, description, Cancel/Confirm buttons |
| **Form dialog** | `dialog.tsx` | Multi-field input — close on Escape, focus trap, max-w-md to max-w-lg |
| **Full-screen** | `sheet.tsx` | Side panel — signature pad, document viewer, investor detail |
| **Alert** | `alert-dialog.tsx` | Non-dismissable — requires explicit action (OK/Cancel) |

**Focus management rules:**
1. Focus moves to first focusable element on open
2. Tab cycles within modal (focus trap)
3. Escape closes modal (unless alert-dialog)
4. Focus returns to trigger element on close

### Empty State Pattern

```tsx
<div className="text-center py-12">
  <Icon className="mx-auto h-12 w-12 text-muted-foreground/50" />
  <h3 className="mt-4 text-lg font-medium">{title}</h3>
  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  <Button className="mt-6" onClick={cta.onClick}>{cta.label}</Button>
</div>
```

### Toast Notifications (Sonner)

| Type | Usage |
|------|-------|
| `toast.success()` | Action completed (saved, sent, confirmed) |
| `toast.error()` | Action failed (API error, validation) |
| `toast.info()` | Informational (copied to clipboard) |

Duration: 4 seconds default, 6 seconds for errors. Position: bottom-right.

---

## WCAG 2.1 AA Contrast Reference

All color pairings verified against WCAG 2.1 AA requirements. Minimum ratios: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold).

### Verified Combinations

| Foreground | Background | Ratio | Status |
|-----------|-----------|-------|--------|
| `#1F2937` (textPrimary) | `#FFFFFF` (white) | 12.6:1 | AA |
| `#1F2937` (textPrimary) | `#F3F4F6` (pageBg) | 10.9:1 | AA |
| `#6B7280` (textSecondary) | `#FFFFFF` (white) | 5.0:1 | AA |
| `#FFFFFF` (white) | `#0A1628` (navy) | 17.2:1 | AA |
| `#FFFFFF` (white) | `#0066FF` (electricBlue) | 4.7:1 | AA |
| `#E2E8F0` (darkTextPrimary) | `#0A1628` (navy) | 13.2:1 | AA |
| `#E2E8F0` (darkTextPrimary) | `#111827` (navyCard) | 11.8:1 | AA |
| `#94A3B8` (darkTextSecondary) | `#0A1628` (navy) | 7.3:1 | AA |
| `#10B981` (success) | `#0A1628` (navy) | 6.3:1 | AA |
| `#F59E0B` (warning) | `#0A1628` (navy) | 8.5:1 | AA |

### Large Text Only Combinations

These colors meet 3:1 for large text but NOT 4.5:1 for normal text on light backgrounds:

| Color | On White | On Navy | Guidance |
|-------|---------|---------|----------|
| `#10B981` (success) | 2.7:1 | 6.3:1 AA | Use on dark backgrounds or as large text only on light |
| `#F59E0B` (warning) | 2.0:1 | 8.5:1 AA | Use on dark backgrounds or as large text only on light |
| `#06B6D4` (info) | 2.6:1 | 6.7:1 AA | Use on dark backgrounds or as large text only on light |
| `#9CA3AF` (textMuted) | 2.8:1 | — | Decorative/non-essential text only |

### Status Badge Contrast

Status badges use the pattern `bg-{color}-100 text-{color}-700 dark:bg-{color}-900/30 dark:text-{color}-400`. All `-700` text on `-100` backgrounds exceed 4.5:1 contrast. All `-400` text on `-900/30` dark backgrounds exceed 4.5:1 contrast.

---

## Skip Navigation & Landmark Patterns

### Skip-to-Content Link

Present in all 3 layout files (`admin/layout.tsx`, `lp/layout.tsx`, `(marketing)/layout.tsx`):

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-[#0066FF] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
>
  Skip to main content
</a>
{/* ... header/nav ... */}
<main id="main-content" tabIndex={-1}>{children}</main>
```

### Landmark Structure

| Element | Role | Usage |
|---------|------|-------|
| `<header>` | banner | Top navigation bar |
| `<nav aria-label="Main navigation">` | navigation | Primary nav links |
| `<main id="main-content">` | main | Page content |
| `<footer>` | contentinfo | Footer links |
| `<aside>` | complementary | Sidebar navigation |

### Mobile Menu Accessibility

Marketing layout includes full keyboard support for the mobile hamburger menu:

- `aria-expanded` tracks open/closed state
- `aria-controls="mobile-menu"` links button to panel
- `aria-label` toggles between "Open menu" / "Close menu"
- **Escape key** closes menu and returns focus to hamburger button
- **Focus trap**: Tab/Shift+Tab cycles within menu links when open
- Menu items use `role="menuitem"` within `role="menu"` container

---

## Font Size Minimums

**WCAG requirement:** No text below 12px (0.75rem / `text-xs`). All sub-12px font sizes (`text-[9px]`, `text-[10px]`, `text-[11px]`) have been replaced with `text-xs` across the entire codebase (76 files, 187 occurrences fixed).

**Enforcement:** The `text-xs` class (12px) is the minimum allowed font size. Any new component must use `text-xs` or larger. The design tokens file (`lib/design-tokens.ts`) defines `xs: "0.75rem"` as the smallest available size.

---

## Usage Guidelines

1. **Colors:** Use design tokens from `lib/design-tokens.ts` in JS contexts; use CSS custom properties via Tailwind classes in JSX
2. **Financial Data:** Always apply `font-mono tabular-nums` to monetary amounts, percentages, and counts
3. **Touch Targets:** Minimum 44px for all interactive elements (WCAG 2.1 AA)
4. **Mobile Inputs:** Use `text-base sm:text-sm` (16px mobile) to prevent iOS auto-zoom
5. **Animations:** Respect `prefers-reduced-motion`; use globals.css keyframes for complex animations, Tailwind utilities for simple transitions
6. **Status Badges:** Use `statusBadgeClasses` from design-tokens.ts for consistent badge styling across light/dark modes
7. **Suite Theming:** Use `NavItem.activeColor` pattern for per-suite sidebar highlights
8. **Dark Mode:** All new components must include `dark:` variant classes
