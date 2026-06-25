# Active Organization Metrics Dashboard Design

## Context

The CRM AI project is split into two repositories:

- `crm-ai-backend`: Node.js, Express, Prisma and Vitest.
- `crm-ai-frontend`: React, Vite, TanStack Query, Tailwind CSS and the existing shared UI primitives.

The current product already exposes organization-scoped CRM data: deals, pipeline columns,
pipeline logs, members, products, WhatsApp integrations, WhatsApp conversations and WhatsApp
messages. The dashboard must use the active organization selected in the frontend and must not
show data from other organizations.

## Goal

Add a complete metrics screen for the active organization, with backend-side aggregation and a
dedicated frontend dashboard that follows the current application structure and visual language.

## Non-Goals

- No global cross-organization dashboard.
- No new database tables or migrations.
- No paid or heavyweight charting dependency.
- No marketing/landing page layout.
- No owner-only restriction; any authenticated member of the active organization can view metrics.

## Backend Design

Create a new `metrics` module under `src/modules/metrics`:

- `metrics.routes.ts`
- `metrics.controller.ts`
- `metrics.schemas.ts`
- `metrics.service.ts`

Register the module in `src/app.ts` at:

```text
GET /api/v1/metrics/overview
```

Query parameters:

- `organizationId`: required string.
- `rangeDays`: optional number constrained to `7`, `14`, `30` or `90`; default `30`.

The controller will follow the existing response envelope:

```json
{
  "success": true,
  "data": {}
}
```

The service will:

- Confirm the authenticated user is a member of `organizationId`.
- Aggregate data with Prisma from existing models only.
- Return Decimal values as strings to avoid precision loss at the API boundary.
- Keep all metrics scoped by `organizationId`.

The response shape:

```ts
type MetricsOverview = {
  range: {
    days: number;
    startsAt: string;
    endsAt: string;
  };
  pipeline: {
    totalDeals: number;
    totalValue: string;
    averageTicket: string | null;
    dealsWithValue: number;
    dealsWithoutValue: number;
    createdInRange: number;
    updatedInRange: number;
    byStage: Array<{
      columnId: string;
      title: string;
      position: number;
      dealCount: number;
      value: string;
    }>;
  };
  activity: {
    totalLogsInRange: number;
    created: number;
    moved: number;
    updated: number;
    deleted: number;
    daily: Array<{
      date: string;
      dealsCreated: number;
      movements: number;
      updates: number;
      deletions: number;
      whatsappMessages: number;
    }>;
    recent: Array<{
      id: string;
      action: string;
      description: string;
      createdAt: string;
      dealTitle: string | null;
      userName: string | null;
    }>;
  };
  whatsapp: {
    status: string;
    connectedPhone: string | null;
    conversations: number;
    activeConversationsInRange: number;
    inboundMessagesInRange: number;
    outboundMessagesInRange: number;
    failedMessagesInRange: number;
    lastMessageAt: string | null;
  };
  products: {
    total: number;
    active: number;
    inactive: number;
    averagePrice: string | null;
  };
  team: {
    totalMembers: number;
    owners: number;
    members: number;
  };
};
```

## Frontend Design

Create a new feature slice:

- `src/features/metrics/api/metrics-api.ts`
- `src/features/metrics/hooks/use-metrics-overview.ts`
- `src/features/metrics/ui/*`

Create a new page:

- `src/pages/metrics-page.tsx`

Register the page in `src/app/router.tsx`:

```text
/metrics
```

Add a top-level header link labelled through i18n as `Metricas` / `Metrics`. It should be visible
to authenticated users, not only admins.

The page will use `useActiveOrganization()` and call the metrics endpoint only when an active
organization exists. It will support a compact range selector for `7`, `14`, `30` and `90` days,
defaulting to `30`.

Visual structure:

1. Header block with page title, active organization name, range selector and refresh action.
2. KPI grid for deals, total value, average ticket and activity in range.
3. Pipeline section with:
   - stage distribution bar chart;
   - value by stage bars;
   - compact funnel list ordered by pipeline position.
4. Activity section with:
   - daily activity chart;
   - recent events list.
5. Operational panels for:
   - WhatsApp status and message counts;
   - product catalog health;
   - team composition.

The UI should use the current design system:

- zinc background and surfaces;
- shared `Card`, `Button`, `Input`/form styles where applicable;
- compact 8px-radius cards;
- dark mode classes;
- responsive grids;
- no nested card layouts;
- SVG or CSS-only charts built in local components.

## Data Formatting

The frontend will convert money strings from the API to numbers only for display calculations.
Currency display continues to use the existing `formatCurrency` helper.

Dates will be formatted with the current locale from `useLocale()`.

Pipeline column titles will pass through `getPipelineColumnNameLabel()` when displayed so default
stage names remain translated.

## Empty, Loading and Error States

If there is no active organization, the page shows a short empty state matching the home page tone.

Loading state uses compact text or skeleton-like muted cards, not a full-screen loader.

Error state shows a concise message and keeps the refresh action available.

When a metric has no data, charts render an empty state inside their section rather than
disappearing.

## Testing Strategy

Backend tests:

- `GET /api/v1/metrics/overview` returns `401` without authentication.
- It returns `400` for an invalid or missing `organizationId`.
- It returns `403` when the authenticated user is not a member of the organization.
- It returns `200` with correct aggregates for seeded deals, columns, logs, products, members and
  WhatsApp data.

Frontend verification:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

The frontend repository currently has no test runner script, so implementation verification will
use the existing static checks and production build.

## Implementation Notes

- Use test-first implementation for the backend endpoint.
- Keep frontend chart components small and typed.
- Invalidate or refetch metrics after the user manually refreshes the dashboard; existing cards and
  logs mutations do not need to auto-update this page unless it is mounted and refetched.
- Avoid changing existing home page KPIs beyond navigation consistency.
