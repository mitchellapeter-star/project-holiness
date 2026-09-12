---
name: Standard Work ordering
description: Persistence and compatibility rules for user-controlled action ordering.
---

Keep user-defined action order scoped to each frequency group. Persist it with an additive ordering field rather than overloading dates, statuses, or completion history. A missing ordering column may disable durable reorder persistence, but must never break workspace hydration or autosave.

**Why:** Standard Work order reflects the sequence in which a user practices commitments. Existing Supabase workspaces may not have the ordering migration yet, so compatibility failures must not expose an empty snapshot to destructive reconciliation.

**How to apply:** When changing action loading, saving, or reordering, preserve per-frequency positions, retain a safe legacy-schema fallback, and require confirmed successful hydration before authenticated autosave.