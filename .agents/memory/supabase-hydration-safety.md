---
name: Supabase hydration safety
description: Prevent authenticated autosave from acting on an empty client snapshot when remote workspace loading fails.
---

Authenticated autosave must remain disabled until the full user workspace has loaded successfully. A missing table, migration mismatch, or partial Supabase query failure must leave synchronization in a blocked/error state.

**Why:** Enabling autosave after a failed load can treat an empty initial client store as authoritative and delete or overwrite valid user-scoped rows.

**How to apply:** Gate every save/delete synchronization path on successful hydration. On load errors, display the error and wait for a successful reload; never continue with destructive collection reconciliation.