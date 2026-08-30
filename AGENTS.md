<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture reference

`docs/HANDBOOK.html` is a full codebase reference — database schema and all 40 migrations, RLS model, every API route, the checkout/payments flow, caching strategy, admin panel, WhatsApp integration, known gotchas, and a dated **Change log**. Read it before making architectural changes. After each batch of changes, update the matching sections **and add a dated Change-log row**, then re-publish the artifact.

## Companion docs

- `CLAUDE.md` — commands, code style, and the "batch → document → recommend" working agreement.
- `AGENT.md` — hard safety boundaries (payment path, RLS, anything with a bill) and refactoring discipline.
- `IMPROVEMENTS.md` — active optimisation backlog (Done + prioritised Active, with 💰/⚠️ flags).
- `.claude/skills/audit-perf.md`, `audit-security.md`, `refactor.md` — on-demand SOPs; each ends by updating the docs + Change log and recommending next steps.
