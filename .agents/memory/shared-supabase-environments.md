---
name: Shared Supabase environments
description: Confirmed data-sharing behavior between the Project Holiness preview and published app.
---

The developer preview and published Project Holiness app intentionally use the same Supabase project. The same email login resolves to the same user-owned workspace in both environments.

**Why:** The user confirmed that a change saved on the published website appeared in the developer preview under the same login.

**How to apply:** Treat preview and production as two clients of the same live workspace. Never use preview for destructive testing, seed authenticated demo data, or assume it has an isolated database.