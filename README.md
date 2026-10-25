# StudioOS (v0.1) — BGP Studios

StudioOS is an internal operating dashboard and AI chief-of-staff tool for **BGP Studios** to manage projects, tasks, monthly income and expenses, and operational priorities in one unified workspace.

The primary goal of **Version 0.1** is clarity and speed: log in, view active projects and tasks, log basic financial activity, and ask StudioOS:

> **“What should I work on?”**

StudioOS inspects live project, task, deadline, and financial data to return no more than three primary priorities with clear recommended next actions, strictly separating verified facts from recommendations.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend / API Layer**: Express + TypeScript (`server.ts`)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth via `@supabase/supabase-js`) with an automatic local PostgreSQL-schema mirror (`data/studioos-db.json`) when Supabase credentials are not yet attached
- **AI Chief of Staff**: Server-side AI service (`src/services/agentService.ts`) supporting OpenAI API (`OPENAI_API_KEY`) and Gemini API (`GEMINI_API_KEY`)

---

## Current Features (v0.1)

1. **Authentication**:
   - Single-owner login flow built for BGP Studios (`bgp.studios.hou@gmail.com`) via Supabase Auth (`signInWithPassword`) and server-side session validation.
2. **Dashboard & Needs Attention**:
   - Displays Active Projects, Open Tasks, Overdue Tasks, Upcoming Deadlines (next 14 days), Monthly Income, Monthly Expenses, Net Income, and Outstanding/Unbilled Work.
   - Dedicated **Needs Attention** section surfacing overdue tasks, unbilled client hours, and release blockers.
3. **Projects CRUD**:
   - Full support for `Idea`, `Planning`, `Active`, `Waiting`, `Review`, `Completed`, and `Archived` statuses and `Low`, `Normal`, `High`, and `Critical` priorities.
   - Pre-seeded with BGP Studios projects: **Caddlatch**, **Pour Across America**, **Mars Roofing**, **Intro**, **FAB**, and **SignalOS**.
4. **Tasks CRUD**:
   - Create, view, edit, filter, complete (`completed_at`), and delete tasks optionally linked to projects.
5. **Financial Activity (Money)**:
   - Manual `Income` and `Expense` transaction entry with monthly totals (`Monthly Income`, `Monthly Expenses`, `Net Income`) and unbilled work visibility.
6. **Ask StudioOS (Read-Only AI Chief of Staff)**:
   - Collects structured live data (`get_projects`, `get_tasks`, `get_overdue_tasks`, `get_transactions`) on the server and returns:
     - **Verified Studio Facts** (separated from recommendations)
     - **Top 3 Priorities** (`Project or area`, `Why it matters`, `Recommended next action`)
   - Strictly read-only in v0.1.

---

## Required Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Public project URL and anon key for client-side Supabase Auth
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-public-key"

# Server-side Supabase credentials (NEVER expose service_role key to browser)
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-secret-key"

# Primary Studio Owner Configuration (v0.1 Single-User Setup)
STUDIOOS_OWNER_EMAIL="bgp.studios.hou@gmail.com"
STUDIOOS_OWNER_NAME="BGP Studios Owner"
STUDIOOS_ACCESS_CODE="bgp-studio-01"

# AI Chief-of-Staff Configuration (Server-Side Only)
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"
GEMINI_API_KEY="your-gemini-api-key"
```

---

## Supabase Setup & Database Migration Instructions

1. Create a new project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Copy and run the contents of `supabase/migrations/001_initial_schema.sql`.
   - This creates the `projects`, `tasks`, and `transactions` tables, indexes, `updated_at` triggers, Row Level Security (RLS) policies for the authenticated owner, and seeds the initial BGP Studios projects.
4. In Supabase **Authentication > Users**, create your primary owner account (`bgp.studios.hou@gmail.com`).
5. Copy your Project URL, `anon` public key, and `service_role` secret key into `.env`.

> **Note for Local Testing**: If `SUPABASE_URL` is not yet configured in `.env`, StudioOS automatically persists all CRUD changes to `data/studioos-db.json` pre-populated with the BGP Studios seed data so you can run and test the entire application immediately.

---

## How to Run Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the development server** (runs Express + Vite on port `3000`):
   ```bash
   npm run dev
   ```
3. **Open in browser**:
   Navigate to `http://localhost:3000`.
4. **Run typecheck / linting and automated tests**:
   ```bash
   npm run lint
   npm test
   ```

---

## Known Limitations (v0.1)

- **Single Primary User**: Multi-user teams, roles, permissions, and multi-company workspaces are intentionally omitted in v0.1.
- **Manual Financial Entry Only**: No automated bank feeds, accounting software sync, invoicing, payroll, or tax/IRS integrations yet.
- **Read-Only AI Agent**: StudioOS v0.1 analyzes and recommends actions but does not send emails, modify database records, publish websites, or alter calendar events automatically.

---

## Suggested Next Steps (v0.2+)

1. Enable optional confirmation-gated write tools in `src/services/tools/index.ts` (`create_task`, `update_project`) so the owner can approve recommended actions with one click.
2. Add time-log / unbilled hours itemization linked directly to `Pour Across America` and client retainer projects.
3. Connect read-only Google Calendar (`get_calendar`) and draft-only Gmail (`draft_email`) integrations.
