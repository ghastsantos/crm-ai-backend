# WhatsApp Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix WhatsApp replies/phone parsing and add organization products so the chatbot can sell concrete items.

**Architecture:** Keep Baileys as the WhatsApp provider, but separate the human phone from the JID used for replies. Add a small `Product` module owned by organizations, expose CRUD routes, and pass active products into the WhatsApp AI prompt.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Vitest, React, TanStack Query, Tailwind.

---

### Task 1: WhatsApp Reply Addressing

**Files:**
- Modify: `src/modules/whatsapp/baileys-message.ts`
- Modify: `src/modules/whatsapp/baileys-provider.ts`
- Modify: `src/modules/whatsapp/whatsapp.service.ts`
- Test: `tests/unit/modules/whatsapp/baileys-message.test.ts`
- Test: `tests/integration/whatsapp.test.ts`

- [ ] Write tests proving LID messages use `remoteJidAlt` as phone and keep the original JID as `replyJid`.
- [ ] Write tests proving newsletter/status/broadcast messages are ignored.
- [ ] Update parser and provider send logic.
- [ ] Run focused WhatsApp tests.

### Task 2: Products Backend

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260616213000_products/migration.sql`
- Create: `src/modules/products/products.schemas.ts`
- Create: `src/modules/products/products.service.ts`
- Create: `src/modules/products/products.controller.ts`
- Create: `src/modules/products/products.routes.ts`
- Modify: `src/app.ts`
- Test: `tests/integration/products.test.ts`

- [ ] Add `Product` model with name, description, price, active flag and organization relation.
- [ ] Add authenticated CRUD routes scoped by organization membership.
- [ ] Run Prisma generate/deploy and focused products tests.

### Task 3: Products In Chatbot

**Files:**
- Modify: `src/modules/whatsapp/gemini-assistant.ts`
- Modify: `src/modules/whatsapp/whatsapp.service.ts`
- Test: `tests/unit/modules/whatsapp/gemini-assistant.test.ts`
- Test: `tests/integration/whatsapp.test.ts`

- [ ] Pass active products into the AI prompt.
- [ ] Make Gemini JSON parser tolerate `null` extracted fields.
- [ ] Improve fallback reply to mention products when the first message is generic.
- [ ] Run focused WhatsApp and Gemini tests.

### Task 4: Frontend UI

**Files:**
- Create: `src/features/products/api/products-api.ts`
- Create: `src/features/products/hooks/use-products.ts`
- Create: `src/features/products/ui/products-settings-panel.tsx`
- Modify: `src/pages/settings-page.tsx`
- Modify: `src/features/whatsapp/ui/whatsapp-panel.tsx`
- Modify: `src/features/cards/ui/card-details-modal.tsx`

- [ ] Add product management in Settings.
- [ ] Hide WhatsApp connect/QR controls when current organization is connected.
- [ ] Remove redundant stage pill from card details and recent conversation Lead badge.
- [ ] Run frontend typecheck/lint/build.
