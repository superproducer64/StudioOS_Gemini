# AGENTS.md — StudioOS Engineering & Agent Guidelines

This document defines the architectural principles, operational boundaries, and development standards for all human and AI contributors working on **StudioOS for BGP Studios**.

## Core Engineering Principles

1. **Simple Architecture First**:
   - StudioOS favors straightforward, transparent architecture that is easy to reason about, debug, and maintain.
   - Avoid over-engineering, deep abstraction hierarchies, or speculative frameworks.

2. **Minimal Dependencies**:
   - Avoid unnecessary npm packages. Use standard platform APIs (`fetch`, `Intl`, native TypeScript types) whenever possible.

3. **Working Software Over Feature Expansion**:
   - Reliability and accuracy of existing workflows (Projects, Tasks, Money, Ask StudioOS) always take priority over adding new features.
   - Do not expand scope beyond the requested version milestone unless required to make the core workflow function.

4. **Strict Separation of Business Logic and UI**:
   - Keep database queries, financial aggregations, and AI prompt/context assembly inside `src/server/repository.ts`, `src/services/tools/index.ts`, and `src/services/agentService.ts`.
   - UI components in `src/components/` must remain focused on presentation and user interaction.

5. **Supabase as the Primary Data Layer**:
   - All schema changes must be reflected in `supabase/migrations/` and typed in `src/types/studioos.ts`.
   - Maintain Row Level Security (RLS) on all tables (`projects`, `tasks`, `transactions`).

6. **Strict TypeScript**:
   - Use explicit interfaces and enums in `src/types/studioos.ts`.
   - Never bypass type safety when modifying database schemas or tool contracts.

7. **Protect Secrets**:
   - Keep all LLM API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) and `SUPABASE_SERVICE_ROLE_KEY` strictly server-side (`server.ts` / `src/services/`).
   - Never expose private keys to browser bundles or client components.

8. **No Destructive Automation Without Explicit Instructions**:
   - StudioOS v0.1 is strictly **read-only** for AI operations.
   - Never allow the agent to autonomously delete data, send emails, modify financial records, publish websites, make purchases, send payments, or alter calendar events unless explicitly instructed and gated by user confirmation in future versions.
   - Never claim an action was completed unless the system confirms it.

9. **Backward Compatibility**:
   - Maintain backward compatibility for existing database columns, seed data structures, and API routes when iterating.

10. **Verification Before Completion**:
    - Always run `npm run lint` (`tsc --noEmit`), `npm test`, and `npm run build` before considering any task complete.
