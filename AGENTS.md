# Pocket

This is the book's reader-facing sample: a monorepo of personal apps used by people and AI agents. `apps/*` holds each app, `packages/*` the shared base, and the repository root is the single Void host (portal, auth, API, MCP, CLI). Forum is one app among several, not the book's subject.

## Required skills

Before reading or editing TypeScript, read `.agents/skills/typescript-best-practices/SKILL.md` and `.agents/skills/principle-type-system-discipline/SKILL.md`. Read referenced principles as needed. Before review, apply `.agents/skills/no-comments/SKILL.md` with the reviewer role in `.agents/pstack-agents/comment-sicko.md`. These are vendored official pstack files; provenance and licenses are recorded in `docs/QUALITY.md` and `docs/pstack-source.json`.

Read Void's installed `.agents/skills/void/SKILL.md` and relevant `node_modules/void/docs/` before changing framework configuration or migrations.

## Architecture

- React + Tailwind v4 + shadcn Base UI. Do not add Radix UI.
- Every loading state renders skeletons (`packages/ui/src/primitives/skeleton.tsx`) shaped like the content that replaces them, never a bare loading message. Loading must not shift the layout, and refreshes keep already loaded content in place. `tests/browser.spec.ts` asserts equal row heights and zero layout shift; add the same assertions for each new loading state.
- Each app defines its operations once with `toolFactory` in `apps/*/src/tools.ts`. The same definitions serve the Web UI (`/api/tools/:name`), standard Streamable HTTP MCP (`/mcp`), and the CLI. Adding an app means one entry in `src/app-tools.ts` and `src/app-catalog.ts`.
- Design every screen for phones first: 44px touch targets, 16px inputs, safe-area insets, bottom sheets for forms. `tests/browser.spec.ts` runs at phone size.
- Parse external data once at boundaries. Derive types from schemas. No unsafe casts, `any`, non-null assertions, or correctness suppressions.
- Production API/MCP return 503 until a login provider has both credentials and an allowlist (`src/security/auth-config.ts`). Do not remove this boundary or open production without authentication. Loopback checks are not authentication.
- No automatic deployment, remote resource creation, credential setup, or public exposure.
- Prefer readable code over explanatory comments. Preserve license notices and externally required directives.

## Verification

Run `npm ci --ignore-scripts`, `npm run tools:setup`, `npm run check`, `npm run typecheck`, `npm test`, `npm run quality`, `npm run build`, and `npm run test:e2e`.

Quality tools must run, not be silently skipped. Keep cccc 15 cognitive / 10 cyclomatic thresholds. Review semantic similarities before extracting abstractions. Do not hide application unused-code findings with broad ignores.

Report blocked stages separately. `ci:headless` verifies HTTP/MCP/D1 but is not a browser substitute. Read `docs/VERIFICATION.md` for this executor's verified limits.
