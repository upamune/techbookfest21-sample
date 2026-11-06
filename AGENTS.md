# Void Task Lab

This is a local-only book stack sample. Task CRUD is provisional, not the book's final subject.

## Required skills

Before reading or editing TypeScript, read `.agents/skills/typescript-best-practices/SKILL.md` and `.agents/skills/principle-type-system-discipline/SKILL.md`. Read referenced principles as needed. Before review, apply `.agents/skills/no-comments/SKILL.md` with the reviewer role in `.agents/pstack-agents/comment-sicko.md`. These are vendored official pstack files; provenance and licenses are recorded in `docs/QUALITY.md` and `docs/pstack-source.json`.

Read Void's installed `.agents/skills/void/SKILL.md` and relevant `node_modules/void/docs/` before changing framework configuration or migrations.

## Architecture

- React + Tailwind v4 + shadcn Base UI. Do not add Radix UI.
- Shared Zod contracts and standard Drizzle D1 service power HTTP and standard Streamable HTTP MCP.
- Parse external data once at boundaries. Derive types from schemas. No unsafe casts, `any`, non-null assertions, or correctness suppressions.
- Keep production API/MCP disabled until a separately approved authentication/authorization design exists. Loopback checks are not authentication.
- No automatic deployment, remote resource creation, credential setup, or public exposure.
- Prefer readable code over explanatory comments. Preserve license notices and externally required directives.

## Verification

Run `npm ci --ignore-scripts`, `npm run tools:setup`, `npm run check`, `npm run typecheck`, `npm test`, `npm run quality`, `npm run build`, and `npm run test:e2e`.

Quality tools must run, not be silently skipped. Keep cccc 15 cognitive / 10 cyclomatic thresholds. Review semantic similarities before extracting abstractions. Do not hide application unused-code findings with broad ignores.

Report blocked stages separately. `ci:headless` verifies HTTP/MCP/D1 but is not a browser substitute. Read `docs/VERIFICATION.md` for this executor's verified limits.
