# Pages Router → App Router Migration Roadmap

> **Generated:** March 4, 2026
> **Total Pages Router routes:** 238
> **Total App Router routes:** ~295
> **Duplicates deleted (Mar 1):** 19

## Status Legend

| Status | Meaning |
|--------|---------|
| **LEGACY** | Only implementation. Actively used by frontend. Migrate in Phase 2. |
| **DEPRECATED** | Zero frontend references. Candidate for deletion after verification. |
| **CRITICAL** | High-priority Phase 2 migration target (datarooms, signature, sign). |
| **PENDING** | Needs migration but not critical for launch. |

## Summary

| Status | Count | Notes |
|--------|-------|-------|
| LEGACY | 174 | Actively called by frontend components |
| DEPRECATED | 34 | Zero frontend callers — verify before deletion |
| CRITICAL | 30 | Tagged for Phase 2 priority (subset of LEGACY) |

---

## 1. Auth Routes (1 route)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 1 | `auth/[...nextauth]` | `pages/api/auth/[...nextauth].ts` | LEGACY | NextAuth core handler. 10+ refs. Must remain until full App Router auth migration |

## 2. Teams — Dataroom Routes (67 routes) — CRITICAL

All dataroom routes are **actively used** (71 frontend files reference them). Tagged **CRITICAL** for Phase 2 migration.

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 2 | `teams/[teamId]/datarooms/[id]/apply-permissions` | `pages/api/teams/[teamId]/datarooms/[id]/apply-permissions.ts` | CRITICAL | |
| 3 | `teams/[teamId]/datarooms/[id]/apply-template` | `pages/api/teams/[teamId]/datarooms/[id]/apply-template.ts` | CRITICAL | |
| 4 | `teams/[teamId]/datarooms/[id]/branding` | `pages/api/teams/[teamId]/datarooms/[id]/branding.ts` | CRITICAL | |
| 5 | `teams/[teamId]/datarooms/[id]/calculate-indexes` | `pages/api/teams/[teamId]/datarooms/[id]/calculate-indexes.ts` | CRITICAL | |
| 6 | `teams/[teamId]/datarooms/[id]/conversations/[[...conversations]]` | `pages/api/teams/[teamId]/datarooms/[id]/conversations/[[...conversations]].ts` | CRITICAL | |
| 7 | `teams/[teamId]/datarooms/[id]/conversations/toggle-conversations` | `pages/api/teams/[teamId]/datarooms/[id]/conversations/toggle-conversations.ts` | CRITICAL | |
| 8 | `teams/[teamId]/datarooms/[id]/documents` | `pages/api/teams/[teamId]/datarooms/[id]/documents/index.ts` | CRITICAL | |
| 9 | `teams/[teamId]/datarooms/[id]/documents/[documentId]` | `pages/api/teams/[teamId]/datarooms/[id]/documents/[documentId].ts` | CRITICAL | |
| 10 | `teams/[teamId]/datarooms/[id]/documents/[documentId]/stats` | `pages/api/teams/[teamId]/datarooms/[id]/documents/[documentId]/stats.ts` | CRITICAL | |
| 11 | `teams/[teamId]/datarooms/[id]/documents/move` | `pages/api/teams/[teamId]/datarooms/[id]/documents/move.ts` | CRITICAL | |
| 12 | `teams/[teamId]/datarooms/[id]/download/bulk` | `pages/api/teams/[teamId]/datarooms/[id]/download/bulk.ts` | CRITICAL | |
| 13 | `teams/[teamId]/datarooms/[id]/duplicate` | `pages/api/teams/[teamId]/datarooms/[id]/duplicate.ts` | CRITICAL | |
| 14 | `teams/[teamId]/datarooms/[id]/ensure-quick-add` | `pages/api/teams/[teamId]/datarooms/[id]/ensure-quick-add.ts` | CRITICAL | |
| 15 | `teams/[teamId]/datarooms/[id]/export-visits` | `pages/api/teams/[teamId]/datarooms/[id]/export-visits.ts` | CRITICAL | |
| 16 | `teams/[teamId]/datarooms/[id]/faqs` | `pages/api/teams/[teamId]/datarooms/[id]/faqs/index.ts` | CRITICAL | |
| 17 | `teams/[teamId]/datarooms/[id]/faqs/[faqId]` | `pages/api/teams/[teamId]/datarooms/[id]/faqs/[faqId].ts` | CRITICAL | |
| 18 | `teams/[teamId]/datarooms/[id]/folders` | `pages/api/teams/[teamId]/datarooms/[id]/folders/index.ts` | CRITICAL | |
| 19 | `teams/[teamId]/datarooms/[id]/folders/[...name]` | `pages/api/teams/[teamId]/datarooms/[id]/folders/[...name].ts` | CRITICAL | |
| 20 | `teams/[teamId]/datarooms/[id]/folders/documents/[...name]` | `pages/api/teams/[teamId]/datarooms/[id]/folders/documents/[...name].ts` | CRITICAL | |
| 21 | `teams/[teamId]/datarooms/[id]/folders/manage` | `pages/api/teams/[teamId]/datarooms/[id]/folders/manage/index.ts` | CRITICAL | |
| 22 | `teams/[teamId]/datarooms/[id]/folders/manage/[folderId]` | `pages/api/teams/[teamId]/datarooms/[id]/folders/manage/[folderId]/index.ts` | CRITICAL | |
| 23 | `teams/[teamId]/datarooms/[id]/folders/manage/[folderId]/dataroom-to-dataroom` | `pages/api/teams/[teamId]/datarooms/[id]/folders/manage/[folderId]/dataroom-to-dataroom.ts` | CRITICAL | |
| 24 | `teams/[teamId]/datarooms/[id]/folders/move` | `pages/api/teams/[teamId]/datarooms/[id]/folders/move.ts` | CRITICAL | |
| 25 | `teams/[teamId]/datarooms/[id]/folders/parents/[...name]` | `pages/api/teams/[teamId]/datarooms/[id]/folders/parents/[...name].ts` | CRITICAL | |
| 26 | `teams/[teamId]/datarooms/[id]/generate-index` | `pages/api/teams/[teamId]/datarooms/[id]/generate-index.ts` | CRITICAL | |
| 27 | `teams/[teamId]/datarooms/[id]/groups` | `pages/api/teams/[teamId]/datarooms/[id]/groups/index.ts` | CRITICAL | |
| 28 | `teams/[teamId]/datarooms/[id]/groups/[groupId]` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/index.ts` | CRITICAL | |
| 29 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/export-visits` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/export-visits.ts` | CRITICAL | |
| 30 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/invite` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/invite.ts` | CRITICAL | |
| 31 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/links` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/links.ts` | CRITICAL | |
| 32 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/members` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/members/index.ts` | CRITICAL | |
| 33 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/members/[memberId]` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/members/[memberId].ts` | CRITICAL | |
| 34 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/permissions` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/permissions.ts` | CRITICAL | |
| 35 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/uninvited` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/uninvited.ts` | CRITICAL | |
| 36 | `teams/[teamId]/datarooms/[id]/groups/[groupId]/views` | `pages/api/teams/[teamId]/datarooms/[id]/groups/[groupId]/views.ts` | CRITICAL | |
| 37 | `teams/[teamId]/datarooms/[id]/links` | `pages/api/teams/[teamId]/datarooms/[id]/links.ts` | CRITICAL | |
| 38 | `teams/[teamId]/datarooms/[id]/links/[linkId]/invite` | `pages/api/teams/[teamId]/datarooms/[id]/links/[linkId]/invite.ts` | CRITICAL | |
| 39 | `teams/[teamId]/datarooms/[id]/permission-groups` | `pages/api/teams/[teamId]/datarooms/[id]/permission-groups/index.ts` | CRITICAL | |
| 40 | `teams/[teamId]/datarooms/[id]/permission-groups/[permissionGroupId]` | `pages/api/teams/[teamId]/datarooms/[id]/permission-groups/[permissionGroupId].ts` | CRITICAL | |
| 41 | `teams/[teamId]/datarooms/[id]/quick-add` | `pages/api/teams/[teamId]/datarooms/[id]/quick-add/index.ts` | CRITICAL | |
| 42 | `teams/[teamId]/datarooms/[id]/quick-add/invite` | `pages/api/teams/[teamId]/datarooms/[id]/quick-add/invite.ts` | CRITICAL | |
| 43 | `teams/[teamId]/datarooms/[id]/reorder` | `pages/api/teams/[teamId]/datarooms/[id]/reorder.ts` | CRITICAL | |
| 44 | `teams/[teamId]/datarooms/[id]/stats` | `pages/api/teams/[teamId]/datarooms/[id]/stats.ts` | CRITICAL | |
| 45 | `teams/[teamId]/datarooms/[id]/users` | `pages/api/teams/[teamId]/datarooms/[id]/users.ts` | CRITICAL | |
| 46 | `teams/[teamId]/datarooms/[id]/viewers` | `pages/api/teams/[teamId]/datarooms/[id]/viewers.ts` | CRITICAL | |
| 47 | `teams/[teamId]/datarooms/[id]/views` | `pages/api/teams/[teamId]/datarooms/[id]/views/index.ts` | CRITICAL | |
| 48 | `teams/[teamId]/datarooms/[id]/views-count` | `pages/api/teams/[teamId]/datarooms/[id]/views-count.ts` | CRITICAL | |
| 49 | `teams/[teamId]/datarooms/[id]/views/[viewId]/custom-fields` | `pages/api/teams/[teamId]/datarooms/[id]/views/[viewId]/custom-fields.ts` | CRITICAL | |
| 50 | `teams/[teamId]/datarooms/[id]/views/[viewId]/history` | `pages/api/teams/[teamId]/datarooms/[id]/views/[viewId]/history.ts` | CRITICAL | |
| 51 | `teams/[teamId]/datarooms/[id]/views/[viewId]/user-agent` | `pages/api/teams/[teamId]/datarooms/[id]/views/[viewId]/user-agent.ts` | CRITICAL | |
| 52 | `teams/[teamId]/datarooms/create-from-folder` | `pages/api/teams/[teamId]/datarooms/create-from-folder.ts` | CRITICAL | |
| 53 | `teams/[teamId]/datarooms/generate` | `pages/api/teams/[teamId]/datarooms/generate.ts` | CRITICAL | |
| 54 | `teams/[teamId]/datarooms/generate-ai` | `pages/api/teams/[teamId]/datarooms/generate-ai.ts` | CRITICAL | |
| 55 | `teams/[teamId]/datarooms/generate-ai-structure` | `pages/api/teams/[teamId]/datarooms/generate-ai-structure.ts` | CRITICAL | |
| 56 | `teams/[teamId]/datarooms/trial` | `pages/api/teams/[teamId]/datarooms/trial.ts` | CRITICAL | |

## 3. Teams — Document Routes (27 routes) — CRITICAL

All document routes are **actively used** (42 frontend files). Tagged **CRITICAL** for Phase 2 migration.

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 57 | `teams/[teamId]/documents/[id]/add-to-dataroom` | `pages/api/teams/[teamId]/documents/[id]/add-to-dataroom.ts` | CRITICAL | |
| 58 | `teams/[teamId]/documents/[id]/advanced-mode` | `pages/api/teams/[teamId]/documents/[id]/advanced-mode.ts` | CRITICAL | |
| 59 | `teams/[teamId]/documents/[id]/annotations` | `pages/api/teams/[teamId]/documents/[id]/annotations/index.ts` | CRITICAL | |
| 60 | `teams/[teamId]/documents/[id]/annotations/[annotationId]` | `pages/api/teams/[teamId]/documents/[id]/annotations/[annotationId]/index.ts` | CRITICAL | |
| 61 | `teams/[teamId]/documents/[id]/annotations/[annotationId]/images` | `pages/api/teams/[teamId]/documents/[id]/annotations/[annotationId]/images.ts` | CRITICAL | |
| 62 | `teams/[teamId]/documents/[id]/change-orientation` | `pages/api/teams/[teamId]/documents/[id]/change-orientation.ts` | CRITICAL | |
| 63 | `teams/[teamId]/documents/[id]/check-notion-accessibility` | `pages/api/teams/[teamId]/documents/[id]/check-notion-accessibility.ts` | CRITICAL | |
| 64 | `teams/[teamId]/documents/[id]/duplicate` | `pages/api/teams/[teamId]/documents/[id]/duplicate.ts` | CRITICAL | |
| 65 | `teams/[teamId]/documents/[id]/export-visits` | `pages/api/teams/[teamId]/documents/[id]/export-visits.ts` | CRITICAL | |
| 66 | `teams/[teamId]/documents/[id]/links` | `pages/api/teams/[teamId]/documents/[id]/links/index.ts` | CRITICAL | |
| 67 | `teams/[teamId]/documents/[id]/overview` | `pages/api/teams/[teamId]/documents/[id]/overview.ts` | CRITICAL | |
| 68 | `teams/[teamId]/documents/[id]/preview-data` | `pages/api/teams/[teamId]/documents/[id]/preview-data.ts` | CRITICAL | |
| 69 | `teams/[teamId]/documents/[id]/stats` | `pages/api/teams/[teamId]/documents/[id]/stats.ts` | CRITICAL | |
| 70 | `teams/[teamId]/documents/[id]/toggle-dark-mode` | `pages/api/teams/[teamId]/documents/[id]/toggle-dark-mode.ts` | CRITICAL | |
| 71 | `teams/[teamId]/documents/[id]/toggle-download-only` | `pages/api/teams/[teamId]/documents/[id]/toggle-download-only.ts` | CRITICAL | |
| 72 | `teams/[teamId]/documents/[id]/update-name` | `pages/api/teams/[teamId]/documents/[id]/update-name.ts` | CRITICAL | |
| 73 | `teams/[teamId]/documents/[id]/update-notion-url` | `pages/api/teams/[teamId]/documents/[id]/update-notion-url.ts` | CRITICAL | |
| 74 | `teams/[teamId]/documents/[id]/versions` | `pages/api/teams/[teamId]/documents/[id]/versions/index.ts` | CRITICAL | |
| 75 | `teams/[teamId]/documents/[id]/video-analytics` | `pages/api/teams/[teamId]/documents/[id]/video-analytics.ts` | CRITICAL | |
| 76 | `teams/[teamId]/documents/[id]/views` | `pages/api/teams/[teamId]/documents/[id]/views/index.ts` | CRITICAL | |
| 77 | `teams/[teamId]/documents/[id]/views-count` | `pages/api/teams/[teamId]/documents/[id]/views-count.ts` | CRITICAL | |
| 78 | `teams/[teamId]/documents/[id]/views/[viewId]/click-events` | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/click-events.ts` | CRITICAL | |
| 79 | `teams/[teamId]/documents/[id]/views/[viewId]/custom-fields` | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/custom-fields.ts` | CRITICAL | |
| 80 | `teams/[teamId]/documents/[id]/views/[viewId]/stats` | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/stats.ts` | CRITICAL | |
| 81 | `teams/[teamId]/documents/[id]/views/[viewId]/user-agent` | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/user-agent.ts` | CRITICAL | |
| 82 | `teams/[teamId]/documents/[id]/views/[viewId]/video-stats` | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/video-stats.ts` | CRITICAL | |
| 83 | `teams/[teamId]/documents/agreement` | `pages/api/teams/[teamId]/documents/agreement.ts` | LEGACY | |

## 4. Teams — Document Search/Move/Update/Processing (4 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 84 | `teams/[teamId]/documents/document-processing-status` | `pages/api/teams/[teamId]/documents/document-processing-status.ts` | LEGACY | Document upload status polling |
| 85 | `teams/[teamId]/documents/move` | `pages/api/teams/[teamId]/documents/move.ts` | LEGACY | Bulk document move |
| 86 | `teams/[teamId]/documents/search` | `pages/api/teams/[teamId]/documents/search.ts` | LEGACY | Document search |
| 87 | `teams/[teamId]/documents/update` | `pages/api/teams/[teamId]/documents/update.ts` | LEGACY | Bulk document update |

## 5. Teams — Folder Routes (8 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 88 | `teams/[teamId]/folders` | `pages/api/teams/[teamId]/folders/index.ts` | LEGACY | 15 refs |
| 89 | `teams/[teamId]/folders/[...name]` | `pages/api/teams/[teamId]/folders/[...name].ts` | LEGACY | |
| 90 | `teams/[teamId]/folders/documents/[...name]` | `pages/api/teams/[teamId]/folders/documents/[...name].ts` | LEGACY | |
| 91 | `teams/[teamId]/folders/manage` | `pages/api/teams/[teamId]/folders/manage/index.ts` | LEGACY | |
| 92 | `teams/[teamId]/folders/manage/[folderId]` | `pages/api/teams/[teamId]/folders/manage/[folderId]/index.ts` | LEGACY | |
| 93 | `teams/[teamId]/folders/manage/[folderId]/add-to-dataroom` | `pages/api/teams/[teamId]/folders/manage/[folderId]/add-to-dataroom.ts` | LEGACY | |
| 94 | `teams/[teamId]/folders/move` | `pages/api/teams/[teamId]/folders/move.ts` | LEGACY | |
| 95 | `teams/[teamId]/folders/parents/[...name]` | `pages/api/teams/[teamId]/folders/parents/[...name].ts` | LEGACY | |

## 6. Teams — Signature Document Routes (12 routes) — CRITICAL

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 96 | `teams/[teamId]/signature-documents` | `pages/api/teams/[teamId]/signature-documents/index.ts` | CRITICAL | 10 refs |
| 97 | `teams/[teamId]/signature-documents/[documentId]` | `pages/api/teams/[teamId]/signature-documents/[documentId]/index.ts` | CRITICAL | |
| 98 | `teams/[teamId]/signature-documents/[documentId]/audit-log` | `pages/api/teams/[teamId]/signature-documents/[documentId]/audit-log.ts` | CRITICAL | |
| 99 | `teams/[teamId]/signature-documents/[documentId]/correct` | `pages/api/teams/[teamId]/signature-documents/[documentId]/correct.ts` | CRITICAL | |
| 100 | `teams/[teamId]/signature-documents/[documentId]/download` | `pages/api/teams/[teamId]/signature-documents/[documentId]/download.ts` | CRITICAL | |
| 101 | `teams/[teamId]/signature-documents/[documentId]/fields` | `pages/api/teams/[teamId]/signature-documents/[documentId]/fields.ts` | CRITICAL | |
| 102 | `teams/[teamId]/signature-documents/[documentId]/remind` | `pages/api/teams/[teamId]/signature-documents/[documentId]/remind.ts` | CRITICAL | |
| 103 | `teams/[teamId]/signature-documents/[documentId]/send` | `pages/api/teams/[teamId]/signature-documents/[documentId]/send.ts` | CRITICAL | |
| 104 | `teams/[teamId]/signature-documents/bulk` | `pages/api/teams/[teamId]/signature-documents/bulk.ts` | CRITICAL | |

## 7. Teams — Signature Template Routes (3 routes) — CRITICAL

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 105 | `teams/[teamId]/signature-templates` | `pages/api/teams/[teamId]/signature-templates/index.ts` | CRITICAL | 4 refs |
| 106 | `teams/[teamId]/signature-templates/[templateId]` | `pages/api/teams/[teamId]/signature-templates/[templateId]/index.ts` | CRITICAL | |
| 107 | `teams/[teamId]/signature-templates/[templateId]/use` | `pages/api/teams/[teamId]/signature-templates/[templateId]/use.ts` | CRITICAL | |

## 8. Teams — Domain Routes (3 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 108 | `teams/[teamId]/domains` | `pages/api/teams/[teamId]/domains/index.ts` | LEGACY | 7 refs |
| 109 | `teams/[teamId]/domains/[domain]` | `pages/api/teams/[teamId]/domains/[domain]/index.ts` | LEGACY | |
| 110 | `teams/[teamId]/domains/[domain]/verify` | `pages/api/teams/[teamId]/domains/[domain]/verify.ts` | LEGACY | |

## 9. Teams — Presets, Links, Tags, Tokens (7 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 111 | `teams/[teamId]/presets` | `pages/api/teams/[teamId]/presets/index.ts` | LEGACY | 3 refs |
| 112 | `teams/[teamId]/presets/[id]` | `pages/api/teams/[teamId]/presets/[id].ts` | LEGACY | |
| 113 | `teams/[teamId]/links/[id]` | `pages/api/teams/[teamId]/links/[id]/index.ts` | LEGACY | 7 refs |
| 114 | `teams/[teamId]/tags` | `pages/api/teams/[teamId]/tags/index.ts` | LEGACY | 4 refs |
| 115 | `teams/[teamId]/tags/[id]` | `pages/api/teams/[teamId]/tags/[id].ts` | LEGACY | |
| 116 | `teams/[teamId]/tokens` | `pages/api/teams/[teamId]/tokens/index.ts` | LEGACY | 1 ref |

## 10. Teams — Viewers, Views, Q&A (8 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 117 | `teams/[teamId]/viewers` | `pages/api/teams/[teamId]/viewers/index.ts` | LEGACY | 5 refs |
| 118 | `teams/[teamId]/viewers/[id]` | `pages/api/teams/[teamId]/viewers/[id].ts` | LEGACY | |
| 119 | `teams/[teamId]/viewers/check-access` | `pages/api/teams/[teamId]/viewers/check-access.ts` | LEGACY | |
| 120 | `teams/[teamId]/views/[id]/archive` | `pages/api/teams/[teamId]/views/[id]/archive.ts` | LEGACY | |
| 121 | `teams/[teamId]/qanda/notes` | `pages/api/teams/[teamId]/qanda/notes.ts` | LEGACY | 1 ref |
| 122 | `teams/[teamId]/qanda/questions` | `pages/api/teams/[teamId]/qanda/questions/index.ts` | LEGACY | |
| 123 | `teams/[teamId]/qanda/questions/[questionId]/reply` | `pages/api/teams/[teamId]/qanda/questions/[questionId]/reply.ts` | LEGACY | |
| 124 | `teams/[teamId]/qanda/questions/[questionId]/status` | `pages/api/teams/[teamId]/qanda/questions/[questionId]/status.ts` | LEGACY | |

## 11. Teams — Agreements (3 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 125 | `teams/[teamId]/agreements` | `pages/api/teams/[teamId]/agreements/index.ts` | LEGACY | 3 refs |
| 126 | `teams/[teamId]/agreements/[agreementId]` | `pages/api/teams/[teamId]/agreements/[agreementId]/index.ts` | LEGACY | |
| 127 | `teams/[teamId]/agreements/[agreementId]/download` | `pages/api/teams/[teamId]/agreements/[agreementId]/download.ts` | LEGACY | |

## 12. Teams — Webhooks, Incoming Webhooks (4 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 128 | `teams/[teamId]/webhooks` | `pages/api/teams/[teamId]/webhooks/index.ts` | LEGACY | 1 ref |
| 129 | `teams/[teamId]/webhooks/[id]` | `pages/api/teams/[teamId]/webhooks/[id]/index.ts` | LEGACY | |
| 130 | `teams/[teamId]/webhooks/[id]/events` | `pages/api/teams/[teamId]/webhooks/[id]/events.ts` | LEGACY | |
| 131 | `teams/[teamId]/incoming-webhooks` | `pages/api/teams/[teamId]/incoming-webhooks.ts` | LEGACY | 1 ref |

## 13. Teams — Investors (3 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 132 | `teams/[teamId]/investors` | `pages/api/teams/[teamId]/investors/index.ts` | LEGACY | 3 refs |
| 133 | `teams/[teamId]/investors/[investorId]/stage` | `pages/api/teams/[teamId]/investors/[investorId]/stage.ts` | LEGACY | |
| 134 | `teams/[teamId]/investors/pipeline` | `pages/api/teams/[teamId]/investors/pipeline.ts` | LEGACY | |

## 14. Teams — Contacts (4 routes) — DEPRECATED

Contacts moved to App Router at `/api/contacts/*`. Pages Router versions have **0 frontend references**.

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 135 | `teams/[teamId]/contacts` | `pages/api/teams/[teamId]/contacts/index.ts` | DEPRECATED | App Router: `/api/contacts` |
| 136 | `teams/[teamId]/contacts/[contactId]` | `pages/api/teams/[teamId]/contacts/[contactId]/index.ts` | DEPRECATED | App Router: `/api/contacts/[id]` |
| 137 | `teams/[teamId]/contacts/[contactId]/activities` | `pages/api/teams/[teamId]/contacts/[contactId]/activities.ts` | DEPRECATED | |
| 138 | `teams/[teamId]/contacts/[contactId]/notes` | `pages/api/teams/[teamId]/contacts/[contactId]/notes.ts` | DEPRECATED | |

## 15. Teams — Reports (3 routes) — DEPRECATED

Reports moved to App Router at `/api/admin/reports/*`. Pages Router versions have **0 frontend references**.

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 139 | `teams/[teamId]/reports` | `pages/api/teams/[teamId]/reports/index.ts` | DEPRECATED | App Router: `/api/admin/reports` |
| 140 | `teams/[teamId]/reports/generate` | `pages/api/teams/[teamId]/reports/generate.ts` | DEPRECATED | |
| 141 | `teams/[teamId]/reports/templates` | `pages/api/teams/[teamId]/reports/templates.ts` | DEPRECATED | |

## 16. Teams — Team Management (11 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 142 | `teams` | `pages/api/teams/index.ts` | LEGACY | Team list/create |
| 143 | `teams/[teamId]` | `pages/api/teams/[teamId]/index.ts` | LEGACY | Team detail |
| 144 | `teams/[teamId]/branding` | `pages/api/teams/[teamId]/branding.ts` | LEGACY | 4 refs |
| 145 | `teams/[teamId]/change-role` | `pages/api/teams/[teamId]/change-role.ts` | LEGACY | 2 refs |
| 146 | `teams/[teamId]/remove-teammate` | `pages/api/teams/[teamId]/remove-teammate.ts` | LEGACY | 1 ref |
| 147 | `teams/[teamId]/invite` | `pages/api/teams/[teamId]/invite.ts` | LEGACY | 7 refs |
| 148 | `teams/[teamId]/invitations` | `pages/api/teams/[teamId]/invitations/index.ts` | LEGACY | 3 refs |
| 149 | `teams/[teamId]/invitations/accept` | `pages/api/teams/[teamId]/invitations/accept.ts` | LEGACY | |
| 150 | `teams/[teamId]/invitations/resend` | `pages/api/teams/[teamId]/invitations/resend.ts` | LEGACY | |
| 151 | `teams/[teamId]/settings` | `pages/api/teams/[teamId]/settings.ts` | LEGACY | 2 refs |
| 152 | `teams/[teamId]/update-name` | `pages/api/teams/[teamId]/update-name.ts` | LEGACY | 1 ref |

## 17. Teams — Misc Admin (10 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 153 | `teams/[teamId]/limits` | `pages/api/teams/[teamId]/limits.ts` | LEGACY | 2 refs |
| 154 | `teams/[teamId]/export-jobs` | `pages/api/teams/[teamId]/export-jobs/index.ts` | LEGACY | 2 refs |
| 155 | `teams/[teamId]/export-jobs/[exportId]` | `pages/api/teams/[teamId]/export-jobs/[exportId]/index.ts` | LEGACY | |
| 156 | `teams/[teamId]/export-jobs/[exportId]/send-email` | `pages/api/teams/[teamId]/export-jobs/[exportId]/send-email.ts` | LEGACY | |
| 157 | `teams/[teamId]/investor-timeline` | `pages/api/teams/[teamId]/investor-timeline.ts` | LEGACY | 1 ref |
| 158 | `teams/[teamId]/workflow-links` | `pages/api/teams/[teamId]/workflow-links.ts` | LEGACY | 1 ref |
| 159 | `teams/[teamId]/ai-settings` | `pages/api/teams/[teamId]/ai-settings.ts` | LEGACY | 2 refs |
| 160 | `teams/[teamId]/audit/export` | `pages/api/teams/[teamId]/audit/export.ts` | LEGACY | 3 refs |
| 161 | `teams/[teamId]/audit/verify` | `pages/api/teams/[teamId]/audit/verify.ts` | LEGACY | |
| 162 | `teams/[teamId]/signature-audit/export` | `pages/api/teams/[teamId]/signature-audit/export.ts` | LEGACY | |

## 18. Teams — Deprecated Admin (7 routes)

Zero frontend references. Functionality either moved to App Router or unused.

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 163 | `teams/[teamId]/tier` | `pages/api/teams/[teamId]/tier.ts` | DEPRECATED | App Router: `/api/tier` |
| 164 | `teams/[teamId]/enable-advanced-mode` | `pages/api/teams/[teamId]/enable-advanced-mode.ts` | DEPRECATED | |
| 165 | `teams/[teamId]/update-advanced-mode` | `pages/api/teams/[teamId]/update-advanced-mode.ts` | DEPRECATED | |
| 166 | `teams/[teamId]/update-encryption-settings` | `pages/api/teams/[teamId]/update-encryption-settings.ts` | DEPRECATED | |
| 167 | `teams/[teamId]/update-replicate-folders` | `pages/api/teams/[teamId]/update-replicate-folders.ts` | DEPRECATED | |
| 168 | `teams/[teamId]/global-block-list` | `pages/api/teams/[teamId]/global-block-list.ts` | DEPRECATED | |
| 169 | `teams/[teamId]/ignored-domains` | `pages/api/teams/[teamId]/ignored-domains.ts` | DEPRECATED | |
| 170 | `teams/[teamId]/esig-usage` | `pages/api/teams/[teamId]/esig-usage.ts` | DEPRECATED | App Router: `/api/billing/usage` |

## 19. Sign Routes (6 routes) — CRITICAL

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 171 | `sign/[token]` | `pages/api/sign/[token].ts` | CRITICAL | Primary signing endpoint. 10 refs. See docs/SIGNATURE-API-MAP.md |
| 172 | `sign/callback` | `pages/api/sign/callback.ts` | LEGACY | |
| 173 | `sign/events` | `pages/api/sign/events.ts` | LEGACY | |
| 174 | `sign/status` | `pages/api/sign/status.ts` | DEPRECATED | 0 refs |
| 175 | `sign/upload` | `pages/api/sign/upload.ts` | LEGACY | |
| 176 | `sign/verify` | `pages/api/sign/verify.ts` | DEPRECATED | 0 refs |

## 20. Signature Routes (6 routes) — CRITICAL

Legacy SignatureDocument-model routes. See `docs/SIGNATURE-API-MAP.md`.

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 177 | `signature/certificate/[documentId]/download` | `pages/api/signature/certificate/[documentId]/download.ts` | CRITICAL | ACTIVE — unique PDF certificate gen |
| 178 | `signature/create-document` | `pages/api/signature/create-document.ts` | DEPRECATED | 0 refs. App Router: `/api/esign/envelopes` |
| 179 | `signature/custom-template` | `pages/api/signature/custom-template.ts` | DEPRECATED | 0 refs. App Router: `/api/esign/templates` |
| 180 | `signature/documents` | `pages/api/signature/documents.ts` | DEPRECATED | 0 refs |
| 181 | `signature/void-document` | `pages/api/signature/void-document.ts` | DEPRECATED | 0 refs. App Router: `/api/esign/envelopes/[id]/void` |
| 182 | `signature/webhook-events` | `pages/api/signature/webhook-events.ts` | DEPRECATED | 0 refs |

## 21. Signatures Routes (1 route)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 183 | `signatures/capture` | `pages/api/signatures/capture.ts` | DEPRECATED | 0 refs. App Router: `/api/signatures/capture` |

## 22. Document Routes (7 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 184 | `documents/upload` | `pages/api/documents/upload.ts` | LEGACY | 2 refs. Unified upload endpoint |
| 185 | `documents/pending-review` | `pages/api/documents/pending-review.ts` | LEGACY | GP review queue |
| 186 | `documents/[docId]/confirm` | `pages/api/documents/[docId]/confirm.ts` | LEGACY | GP approve doc |
| 187 | `documents/[docId]/reject` | `pages/api/documents/[docId]/reject.ts` | LEGACY | GP reject doc |
| 188 | `documents/[docId]/request-reupload` | `pages/api/documents/[docId]/request-reupload.ts` | LEGACY | GP request revision |
| 189 | `documents/[docId]/sign-data` | `pages/api/documents/[docId]/sign-data.ts` | LEGACY | Signing field data |
| 190 | `documents/[docId]/signed-pdf` | `pages/api/documents/[docId]/signed-pdf.ts` | LEGACY | Download signed PDF |

## 23. Approvals Routes (4 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 191 | `approvals/pending` | `pages/api/approvals/pending.ts` | LEGACY | 2 refs |
| 192 | `approvals/[approvalId]/approve` | `pages/api/approvals/[approvalId]/approve.ts` | LEGACY | |
| 193 | `approvals/[approvalId]/approve-with-changes` | `pages/api/approvals/[approvalId]/approve-with-changes.ts` | LEGACY | |
| 194 | `approvals/[approvalId]/request-changes` | `pages/api/approvals/[approvalId]/request-changes.ts` | LEGACY | |

## 24. Jobs Routes (7 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 195 | `jobs/export-visits` | `pages/api/jobs/export-visits.ts` | LEGACY | Background job |
| 196 | `jobs/process-dataroom-changes` | `pages/api/jobs/process-dataroom-changes.ts` | LEGACY | |
| 197 | `jobs/send-dataroom-notification` | `pages/api/jobs/send-dataroom-notification.ts` | LEGACY | |
| 198 | `jobs/send-dataroom-view-notification` | `pages/api/jobs/send-dataroom-view-notification.ts` | LEGACY | |
| 199 | `jobs/send-conversation-new-message-notification` | `pages/api/jobs/send-conversation-new-message-notification.ts` | DEPRECATED | 0 refs |
| 200 | `jobs/send-conversation-team-member-notification` | `pages/api/jobs/send-conversation-team-member-notification.ts` | DEPRECATED | 0 refs |
| 201 | `jobs/send-pause-resume-notification` | `pages/api/jobs/send-pause-resume-notification.ts` | DEPRECATED | 0 refs |

## 25. MuPDF Routes (4 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 202 | `mupdf/convert-page` | `pages/api/mupdf/convert-page.ts` | LEGACY | PDF processing |
| 203 | `mupdf/get-pages` | `pages/api/mupdf/get-pages.ts` | LEGACY | |
| 204 | `mupdf/get-thumbnail` | `pages/api/mupdf/get-thumbnail.ts` | LEGACY | |
| 205 | `mupdf/process-pdf-local` | `pages/api/mupdf/process-pdf-local.ts` | LEGACY | |

## 26. File Routes (4 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 206 | `file/browser-upload` | `pages/api/file/browser-upload.ts` | LEGACY | Vercel Blob upload |
| 207 | `file/image-upload` | `pages/api/file/image-upload.ts` | LEGACY | |
| 208 | `file/notion` | `pages/api/file/notion/index.ts` | LEGACY | Notion proxy |
| 209 | `file/s3/get-presigned-get-url` | `pages/api/file/s3/get-presigned-get-url.ts` | LEGACY | S3 URL generation |

## 27. Links Routes (3 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 210 | `links` | `pages/api/links/index.ts` | LEGACY | Link CRUD |
| 211 | `links/[id]` | `pages/api/links/[id]/index.ts` | LEGACY | Link detail |
| 212 | `links/[id]/approve-access` | `pages/api/links/[id]/approve-access.ts` | LEGACY | Access request approval |

## 28. Tracking Routes (3 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 213 | `record_click` | `pages/api/record_click.ts` | LEGACY | 5 refs |
| 214 | `record_view` | `pages/api/record_view.ts` | LEGACY | 4 refs |
| 215 | `record_video_view` | `pages/api/record_video_view.ts` | LEGACY | 4 refs |

## 29. Branding Routes (2 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 216 | `branding/tenant` | `pages/api/branding/tenant.ts` | LEGACY | 2 refs |
| 217 | `branding/manifest` | `pages/api/branding/manifest.ts` | DEPRECATED | 0 refs |

## 30. Notification / Feedback Routes (3 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 218 | `notifications` | `pages/api/notifications/index.ts` | LEGACY | 2 refs |
| 219 | `feedback` | `pages/api/feedback.ts` | LEGACY | 2 refs |
| 220 | `record_reaction` | `pages/api/record_reaction.ts` | LEGACY | 1 ref |

## 31. Subscription / Billing Routes (2 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 221 | `subscriptions/create` | `pages/api/subscriptions/create.ts` | DEPRECATED | 0 refs. CRM billing at `/api/billing/*` |
| 222 | `internal/billing/automatic-unpause` | `pages/api/internal/billing/automatic-unpause.ts` | DEPRECATED | 0 refs |

## 32. Misc Routes (16 routes)

| # | Route | File | Status | Notes |
|---|-------|------|--------|-------|
| 223 | `revalidate` | `pages/api/revalidate.ts` | LEGACY | 4 refs. ISR revalidation |
| 224 | `request-invite` | `pages/api/request-invite.ts` | LEGACY | 3 refs. Quick-add workflow |
| 225 | `unsubscribe/dataroom/[id]` | `pages/api/unsubscribe/dataroom/[id].ts` | LEGACY | 2 refs |
| 226 | `account/passkeys` | `pages/api/account/passkeys/index.ts` | LEGACY | 2 refs |
| 227 | `account/passkeys/[id]` | `pages/api/account/passkeys/[id].ts` | LEGACY | |
| 228 | `view/auto-verify-session` | `pages/api/view/auto-verify-session.ts` | LEGACY | 2 refs |
| 229 | `agreements/download` | `pages/api/agreements/download.ts` | LEGACY | 1 ref |
| 230 | `links/download` | `pages/api/links/download/index.ts` | LEGACY | 1 ref |
| 231 | `viewer/notes` | `pages/api/viewer/notes.ts` | DEPRECATED | 0 refs |
| 232 | `viewer/questions` | `pages/api/viewer/questions.ts` | DEPRECATED | 0 refs |
| 233 | `progress-token` | `pages/api/progress-token.ts` | LEGACY | 1 ref |
| 234 | `og` | `pages/api/og.ts` | LEGACY | OG image generation |
| 235 | `stripe/create-checkout` | `pages/api/stripe/create-checkout.ts` | LEGACY | |
| 236 | `stripe/portal` | `pages/api/stripe/portal.ts` | LEGACY | |
| 237 | `stripe/webhook` | `pages/api/stripe/webhook.ts` | LEGACY | SaaS billing webhook |
| 238 | `links/download/bulk` | `pages/api/links/download/bulk.ts` | LEGACY | |

---

## Phase 2 Migration Priorities

### Priority 1: Dataroom & Document Routes (94 routes)
The core platform functionality. 71+ frontend files depend on dataroom routes. Migrate as a cohesive batch.

**Approach:** Create `app/api/teams/[teamId]/datarooms/` App Router tree. Use `withTeamAuth` pattern. Keep URL structure identical.

### Priority 2: Signature Routes (21 routes)
E-signature document management. 10 frontend files reference `signature-documents`. Some routes have App Router equivalents in `/api/esign/*` namespace.

**Approach:** Evaluate which routes duplicate `/api/esign/*` functionality. Migrate unique routes to App Router. Delete true duplicates.

### Priority 3: Sign Routes (4 active routes)
Token-based signing endpoints. `sign/[token]` is critical infrastructure with 10 frontend references.

**Approach:** Migrate `sign/[token]` to App Router. Verify `sign/callback`, `sign/events`, `sign/upload` callers before migrating.

### Priority 4: File Handlers (4 routes)
PDF processing and file upload endpoints. Require `bodyParser: false` config for multipart handling.

**Approach:** Use App Router's native `Request` body streaming. Test file upload flows thoroughly.

### Priority 5: Everything Else (~115 routes)
Team management, folders, links, tracking, jobs, etc. Lower risk, less frequently accessed.

---

## Deprecated Route Deletion Candidates (34 routes)

These routes have **zero frontend references** and can be safely deleted after verification:

1. `teams/[teamId]/contacts/*` (4 routes) — moved to `/api/contacts/*`
2. `teams/[teamId]/reports/*` (3 routes) — moved to `/api/admin/reports/*`
3. `teams/[teamId]/tier` — moved to `/api/tier`
4. `teams/[teamId]/esig-usage` — moved to `/api/billing/usage`
5. `teams/[teamId]/enable-advanced-mode` — dead feature toggle
6. `teams/[teamId]/update-advanced-mode` — dead feature toggle
7. `teams/[teamId]/update-encryption-settings` — dead feature toggle
8. `teams/[teamId]/update-replicate-folders` — dead feature toggle
9. `teams/[teamId]/global-block-list` — dead feature
10. `teams/[teamId]/ignored-domains` — dead feature
11. `signature/create-document` — replaced by `/api/esign/envelopes`
12. `signature/custom-template` — replaced by `/api/esign/templates`
13. `signature/documents` — replaced by envelope list
14. `signature/void-document` — replaced by `/api/esign/envelopes/[id]/void`
15. `signature/webhook-events` — dead
16. `signatures/capture` — has App Router equivalent
17. `sign/status` — dead
18. `sign/verify` — dead
19. `jobs/send-conversation-new-message-notification` — dead
20. `jobs/send-conversation-team-member-notification` — dead
21. `jobs/send-pause-resume-notification` — dead
22. `subscriptions/create` — CRM billing at `/api/billing/*`
23. `internal/billing/automatic-unpause` — dead
24. `branding/manifest` — dead
25. `viewer/notes` — dead
26. `viewer/questions` — dead

---

## Migration Pattern Reference

**Pages Router → App Router conversion:**

```typescript
// BEFORE (Pages Router)
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  // ...
  return res.status(200).json({ data });
}

// AFTER (App Router)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
  return NextResponse.json({ data });
}
```

**Key differences:**
- `req.query.paramName` → `req.nextUrl.searchParams.get("paramName")` or route params
- `req.body` → `await req.json()`
- `res.status(X).json()` → `NextResponse.json({}, { status: X })`
- `getServerSession(req, res, authOptions)` → `getServerSession(authOptions)`
- Add `export const dynamic = "force-dynamic"` to all route files
- Rate limiting: use `appRouterRateLimit()` variants from `lib/security/rate-limiter.ts`
- RBAC: use `enforceRBACAppRouter()` from `lib/auth/rbac.ts`

---

## Vercel Function Config Migration

When migrating Pages Router routes that have custom `maxDuration` settings in `vercel.json`, the App Router equivalent uses the **route segment config** export pattern instead.

### Current `vercel.json` Function Configs

| Pages Router Path | `maxDuration` | Purpose |
|-------------------|---------------|---------|
| `pages/api/mupdf/convert-page.ts` | 180s | PDF page conversion |
| `pages/api/mupdf/annotate-document.ts` | 300s | PDF annotation |
| `pages/api/mupdf/process-pdf-local.ts` | 300s | Local PDF processing |
| `pages/api/sign/[token].ts` | 30s | E-signature signing |
| `pages/api/webhooks/persona.ts` | 30s | Persona KYC webhook |
| `pages/api/webhooks/esign.ts` | 30s | E-signature webhook |

### Migration Pattern

When migrating any of the above routes to App Router (`app/api/`), you **must** add the `maxDuration` route segment config export at the top of the new `route.ts` file:

```typescript
// app/api/mupdf/convert-page/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 180; // seconds — matches vercel.json setting

export async function POST(req: NextRequest) {
  // ...
}
```

### Important Notes

1. **Do not remove the `vercel.json` entry** until the Pages Router file is fully deleted and the App Router route is verified in production.
2. If both `vercel.json` and route segment config exist for the same logical route, Vercel uses the route segment config (App Router takes precedence).
3. The default `maxDuration` for Vercel serverless functions is 60s on Pro plans. Only add the export when the route needs a non-default timeout.
4. After migration, clean up the corresponding `vercel.json` `functions` entry to avoid stale config.

---

## Prisma Schema createdBy Standardization

When migrating routes that create database records, ensure the `createdBy` pattern follows the best practice. Three patterns exist in the codebase:

### Pattern A: Best Practice (FK relation) — Use for all new models

```prisma
createdById String
createdBy   User @relation("ModelCreatedBy", fields: [createdById], references: [id])
```

**Models using Pattern A:** LPDocument, SignatureDocument, Deal, DealDocument, DocumentAnnotation

### Pattern B: Legacy (plain String, no FK) — Migrate in Phase 2

```prisma
createdBy   String?  // No FK — just stores userId string
```

**Affected fields (11 across 8 models):**
- `Tag.createdBy`
- `Fund.createdBy`
- `Investor.approvedBy`
- `Transaction.confirmedBy`, `Transaction.initiatedBy`
- `LPDocumentReview.reviewedBy`
- `AccessRequest.reviewedBy`
- `ProfileChangeRequest.requestedBy`, `ProfileChangeRequest.reviewedBy`

### Pattern C: Partial (has `createdById` but no @relation)

```prisma
createdById String?  // Has the right field name but missing @relation
```

**Affected models:** SignatureTemplate, ReportTemplate, GeneratedReport

### Migration Instructions

When migrating a Pages Router route that writes to any Pattern B/C field:
1. **Do NOT change the schema field** in the same PR (requires migration)
2. **Do** use the existing field name as-is
3. **Do** create a follow-up issue to add the FK relation in Phase 2
4. See `prisma/schema.prisma` header comments for the full pattern catalog

---

## Vercel Function Config Migration

When migrating a Pages Router route to the App Router, any custom Vercel function configuration (e.g., `maxDuration`, `memory`) must move from `vercel.json` to an inline export in the new App Router route file.

### Pattern

**Before (Pages Router — `vercel.json`):**
```json
{
  "functions": {
    "pages/api/mupdf/convert-page.ts": { "maxDuration": 180 }
  }
}
```

**After (App Router — inline export):**
```typescript
// app/api/mupdf/convert-page/route.ts
export const maxDuration = 180;
export const dynamic = "force-dynamic";
```

### Routes Requiring Config Migration

The following 6 Pages Router routes have custom `maxDuration` values in `vercel.json` that must be carried forward when migrating:

| Pages Router Route | maxDuration | Notes |
|--------------------|-------------|-------|
| `pages/api/mupdf/convert-page.ts` | 180s | PDF page conversion — CPU-intensive |
| `pages/api/mupdf/annotate-document.ts` | 300s | PDF annotation — large documents |
| `pages/api/mupdf/process-pdf-local.ts` | 300s | Local PDF processing — large files |
| `pages/api/sign/[token].ts` | 30s | E-signature submission |
| `pages/api/webhooks/persona.ts` | 30s | Persona KYC webhook |
| `pages/api/webhooks/esign.ts` | 30s | E-sign webhook (legacy) |

### Migration Checklist

When migrating any of these routes:

1. Create the App Router equivalent under `app/api/`
2. Add `export const maxDuration = N;` at the top of the route file
3. Add `export const dynamic = "force-dynamic";`
4. Remove the corresponding entry from `vercel.json` `functions` block
5. Verify the route works in preview deployment before merging

### Notes

- `maxDuration` defaults to 60s on Vercel Hobby and 300s on Pro/Enterprise
- The `memory` setting is deprecated on Vercel Active CPU billing — do not migrate it
- Routes with 30s `maxDuration` are at the default and technically don't need the export, but adding it explicitly documents the intent

---

## Related Documentation

- `docs/PAGES_TO_APP_ROUTER_MIGRATION.md` — Original Phase 1 migration plan and audit log
- `docs/SIGNATURE-API-MAP.md` — Complete signature API namespace mapping
- `docs/API_ROUTE_INVENTORY.md` — Full 593-route inventory with auth audit
