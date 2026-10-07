<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Follow the business rules

Before changing anything that charges, holds, releases or refunds money (fees, deposits, escrow, rentals, disputes, payouts, payment methods), read [BusinessRules.md](BusinessRules.md) and implement what it says. If the code and that file disagree, the file wins: fix the code, or ask the user before changing a rule. Rules marked **(open)** are undecided, so build only a placeholder for them. When a rule changes, update BusinessRules.md first, then the code.

# Refer to figures during implementation

Always consult the relevant figures, diagrams, screenshots, and design mockups provided by the user or included in the project before and during implementation. Use them to guide layout, styling, behavior, and architecture, as applicable. Reference the specific figure by its label, filename, or path when explaining implementation decisions, and verify the completed work against it. If a required figure is missing or unclear, ask for clarification rather than inventing its details.
