# MAZZI working agreement

This folder contains planning documentation only. Do not bootstrap an application, select vendors, install dependencies, create external accounts, or implement a feature unless the user explicitly requests that incremental task.

- Use **MAZZI** only as a provisional working name; it is not legally cleared.
- `docs/00-context-and-decisions.md` is the source of truth for confirmed decisions.
- Anything marked **Decision pending** is unresolved: do not silently select an option.
- Scope is a São Paulo marketplace MVP for practical driving lessons. “Minha jornada para a CNH” and other future features require a new approval.
- For implementation, preserve booking availability, payment integrity, RBAC, privacy, and auditability; update relevant docs and tests with each change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
