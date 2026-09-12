---
name: Supabase-ready MVP boundary
description: The durable decision for shipping a usable preview before a Supabase project is connected.
---

The app should remain usable without Supabase credentials, using local persistence as a preview fallback. When Supabase is configured, auth is handled by Supabase Auth and the authenticated user's workspace is stored in one RLS-protected JSON payload table.

**Why:** The user asked for a polished MVP ready to connect to Supabase, not for a project-specific credential setup. This keeps the preview demonstrable while making the secure path explicit.

**How to apply:** Preserve the optional-client boundary and never add local password storage. Any future schema split should preserve user-scoped RLS policies and cloud hydration before writes.