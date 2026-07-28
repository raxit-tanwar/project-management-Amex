# FlowDesk — CLAUDE.md

## Project Overview

**FlowDesk** is a Next.js 16 project management web app. It provides a Kanban board, task management, integrated time tracking, quality checklists, and reports — all backed by Supabase (auth + database).

PRD lives at: `../PRD_ProjectManagementApp.md`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI | Lucide React, Framer Motion |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + RLS) |
| Date utils | date-fns |

---

## Project Structure

```
flowdesk/
├── app/
│   ├── page.tsx                     # Public landing page
│   ├── layout.tsx                   # Root layout
│   ├── (auth)/                      # Auth routes (login, signup, reset-password)
│   │   ├── actions.ts               # Server actions for auth
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/                 # Protected app routes
│   │   ├── layout.tsx               # Dashboard layout (sidebar, timer bar)
│   │   ├── dashboard/page.tsx       # Kanban board (server component)
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx + SettingsClient.tsx
│   └── auth/callback/route.ts       # Supabase OAuth callback
├── components/
│   ├── board/
│   │   ├── BoardClient.tsx          # Main Kanban board (client)
│   │   ├── ProjectCard.tsx          # Individual project card
│   │   ├── ProjectDetailPanel.tsx   # Slide-over panel for project details
│   │   └── NewProjectModal.tsx      # Project creation modal
│   ├── reports/ReportsClient.tsx    # Reports charts + tables
│   ├── timer/
│   │   ├── TimerWidget.tsx          # Floating persistent timer widget
│   │   └── GlobalTimerBar.tsx       # Timer bar shown in dashboard layout
│   └── ui/Sidebar.tsx               # Navigation sidebar
├── context/
│   └── TimerContext.tsx             # Global timer state (React context)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser Supabase client
│   │   ├── server.ts                # Server Supabase client (cookies)
│   │   └── middleware.ts            # Auth middleware helper
│   └── utils.ts                     # clsx/tailwind-merge helper (cn)
└── scripts/
    └── seed_data.ts                 # Dev seed script
```

---

## Supabase Schema

**Project:** `Project Mangement` (`mdtiqwvpnbfwqdfxpaag`) — region: `ap-south-1`

All tables use RLS. Every user-owned table has a `user_id uuid → auth.users.id` FK.

### Tables

#### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | → auth.users.id |
| display_name | text | nullable |
| avatar_url | text | nullable |
| created_at / updated_at | timestamptz | |

#### `user_settings`
| Column | Type | Default |
|---|---|---|
| id | uuid PK | → auth.users.id |
| work_start_time | text | `'09:00'` |
| work_end_time | text | `'18:00'` |
| idle_alert_minutes | int | `30` |
| long_session_alert_minutes | int | `120` |
| monthly_target_hours | int | nullable — personal hours/month target on Reports > Goals; null falls back to the app default (160h) |

#### `stages`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| name | text | |
| color | text | default `#6366f1` |
| position | int | default 0 |

#### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| name | text | |

#### `projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| stage_id | uuid | → stages.id |
| client_id | uuid | → clients.id (nullable) |
| name | text | |
| description | text | nullable |
| client | text | nullable (legacy text field) |
| client_color | text | default `#6366f1` |
| priority | text | check: Low/Medium/High/Critical |
| start_date / due_date | date | nullable |
| notes | text | nullable |
| archived | bool | default false |
| stage_changed_at | timestamptz | |
| event_code | text | nullable |

#### `tasks`
Repurposed as per-project **action items** (to-dos with a status + optional due date). No timer.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid | → projects.id |
| user_id | uuid | → auth.users |
| name | text | |
| description | text | nullable |
| estimated_minutes | int | nullable (legacy) |
| status | text | check: To Do/In Progress/Done |
| assignee | text | nullable |
| position | int | default 0 |
| due_at | timestamptz | nullable — optional due date/time; null = no date |
| due_has_time | bool | default false — true when due_at carries a time-of-day (else date-only) |

#### `checklist_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid | → projects.id |
| user_id | uuid | → auth.users |
| text | text | |
| checked | bool | default false |
| checked_by | text | nullable |
| checked_at | timestamptz | nullable |
| position | int | default 0 |

#### `checklist_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| text | text | |
| position | int | default 0 |

#### `time_entries`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| project_id | uuid | → projects.id (nullable) |
| task_id | uuid | → tasks.id (nullable) |
| started_at | timestamptz | |
| ended_at | timestamptz | nullable |
| duration_seconds | int | nullable |
| notes | text | nullable |

#### `project_notes_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid | → projects.id |
| user_id | uuid | → auth.users |
| content | text | |
| is_task | bool | default false — true when posted via "Make this a task"; also creates a matching `tasks` row and renders a "Task" pill in the Notes tab |

---

## Database Migrations

SQL migrations live in `supabase/migrations/` (Supabase CLI format: `<timestamp>_<name>.sql`). Apply them to a project with `supabase db push`, or run the SQL directly against the database. Migrations are additive and idempotent (`IF NOT EXISTS`, guarded backfills) so they're safe to re-run.

---

## Dev Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev        # http://localhost:3000

# Build
npm run build

# Lint
npm run lint
```

---

## Key Conventions

- **Server vs Client components:** Dashboard pages fetch data server-side via `lib/supabase/server.ts`, pass to `*Client.tsx` client components.
- **Auth:** Supabase Auth with cookie-based sessions via `@supabase/ssr`. Middleware at `lib/supabase/middleware.ts` protects `/dashboard`, `/reports`, `/settings`.
- **Timer state:** Global timer lives in `context/TimerContext.tsx` — wrap provider high enough to persist across route changes.
- **Styling:** Tailwind v4 utility classes + CSS variables for theming (dark mode via CSS vars on `:root`). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Forms:** React Hook Form + Zod schema validation on all modals/forms.
