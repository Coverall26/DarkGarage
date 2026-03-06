# Components Directory — Naming Conventions & Architecture

## Directory Structure

```
components/
├── ui/                  # shadcn/ui primitives (Button, Input, Dialog, etc.)
├── admin/               # GP admin dashboard components
│   ├── dashboard/       # Dashboard sub-components (extracted cards, grids)
│   ├── fund-detail/     # Fund detail page sub-components
│   ├── investor-review/ # Investor review page sub-components
│   └── shared/          # Shared admin utilities (empty-state, etc.)
├── lp/                  # LP portal components (header, bottom-tab-bar, dashboard)
│   └── dashboard/       # LP dashboard sub-components
├── onboarding/          # LP onboarding step components
├── crm/                 # CRM components (ContactTable, Kanban, OutreachQueue)
├── esign/               # E-signature components (FundRoomSign, FundRoomSignFlow)
├── signature/           # Signing page components (PDFSignatureViewer, etc.)
├── approval/            # GP approval queue (GPApprovalQueue)
├── documents/           # Document management (CRUD, folders, stats)
│   └── actions/         # Document action hooks (useDeleteFolderModal, etc.)
├── view/                # Public viewer components (document + dataroom)
│   ├── access-form/     # Viewer access gate forms (password, NDA, accreditation)
│   └── dataroom/        # Dataroom-specific viewer components
├── links/               # Link management (CRUD, sharing)
│   └── link-sheet/      # Link settings sheet sections
├── datarooms/           # Dataroom management (CRUD, stats)
├── analytics/           # Analytics views (links-table, visitors-table)
├── visitors/            # Visitor management views
├── emails/              # Email templates (React Email components)
├── charts/              # Charting components (bar-chart, etc.)
├── layouts/             # App layout components (app.tsx, breadcrumb)
├── sidebar/             # Navigation sidebar (app-sidebar)
├── settings/            # Legacy settings components (mostly migrated to admin)
├── shared/              # Shared utilities (icons, etc.)
└── error-boundaries/    # React error boundary components
```

## Intentional Filename Duplicates

Several filenames appear in multiple directories. These are **intentionally separate
components** serving different purposes — NOT duplicates to consolidate.

### GP Config vs LP Viewer Pattern

| Filename | GP Config Location | LP Viewer Location | Why Separate |
|----------|-------------------|-------------------|--------------|
| `accreditation-section.tsx` | `links/link-sheet/` | `view/access-form/` | GP configures settings; LP fills out the gate form |
| `agreement-section.tsx` | `links/link-sheet/` | `view/access-form/` | GP toggles NDA requirement; LP signs the NDA |
| `custom-fields-section.tsx` | `links/link-sheet/` | `view/access-form/` | GP defines custom fields; LP fills them in |
| `password-section.tsx` | `links/link-sheet/` | `view/access-form/` | GP sets password; LP enters it |

### Document Management vs Viewer Pattern

| Filename | Management Location | Viewer Location | Why Separate |
|----------|-------------------|-----------------|--------------|
| `document-card.tsx` | `documents/` | `view/dataroom/` | Admin CRUD card vs read-only viewer card |
| `folder-card.tsx` | `documents/` | `view/dataroom/` | Admin folder card vs public viewer card |

### Domain-Specific Variants

| Filename | Location 1 | Location 2 | Why Separate |
|----------|-----------|-----------|--------------|
| `stats-card.tsx` | `datarooms/` | `documents/` | Different data sources (dataroom stats vs document stats) |
| `export-visits-modal.tsx` | `datarooms/` | `documents/` | Different export schemas (groups vs pages) |
| `links-table.tsx` | `links/` | `analytics/` | Full CRUD table vs read-only analytics view |
| `visitors-table.tsx` | `visitors/` | `analytics/` | Full visitor management vs analytics view |
| `empty-state.tsx` | `admin/shared/` | `lp/` | Different styling and CTAs per audience |
| `breadcrumb.tsx` | `documents/` | `layouts/` | Simple folder breadcrumb vs full app routing breadcrumb |
| `bar-chart.tsx` | `shared/icons/` | `charts/` | SVG icon vs Recharts component |
| `pagination.tsx` | `documents/` | `ui/` | Domain pagination vs shadcn primitive |
| `delete-folder-modal.tsx` | `documents/` | `documents/actions/` | Modal UI component vs hook that wraps it |

### Component vs Hook Pattern (actions/)

The `documents/actions/` directory contains **hooks** that wrap modal components:
- `actions/delete-folder-modal.tsx` exports `useDeleteFolderModal` hook
- `delete-folder-modal.tsx` exports the `DeleteFolderModal` UI component

The hook imports and renders the component — they are complementary, not duplicates.

## Naming Conventions

1. **Page components**: `page-client.tsx` (Next.js App Router client components)
2. **UI primitives**: lowercase kebab-case in `ui/` (e.g., `button.tsx`, `dialog.tsx`)
3. **Domain components**: PascalCase exports, kebab-case filenames (e.g., `ContactTable` in `contact-table.tsx`)
4. **Email templates**: kebab-case in `emails/` (e.g., `investor-welcome.tsx`)
5. **Step components**: `Step{N}{Name}.tsx` in wizard directories (e.g., `Step1CompanyInfo.tsx`)
6. **Section components**: kebab-case in `sections/` subdirectories (e.g., `team-management.tsx`)
7. **Hooks**: `use-{name}.ts` or embedded in component files
8. **Types**: `shared-types.ts` for shared interfaces within a domain

## Key Architecture Rules

- Components in `ui/` are shadcn/ui primitives — do not add business logic here
- Components in `view/` are for **public** (unauthenticated or token-based) viewing
- Components in `admin/` require GP authentication
- Components in `lp/` require LP authentication
- Email templates in `emails/` use React Email and are rendered server-side
- Error boundaries in `error-boundaries/` wrap critical user flows
