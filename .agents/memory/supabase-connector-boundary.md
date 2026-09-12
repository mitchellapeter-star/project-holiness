---
name: Supabase connector boundary
description: Constraints when using the attached Supabase connector alongside the browser Supabase client.
---

The attached Supabase connector can inspect the project REST API, but it does not automatically create application tables or provide browser `VITE_SUPABASE_*` values. The web client still needs the public Supabase URL and anon key, and the workspace schema must be applied in the connected Supabase project.

**Why:** A REST probe returned a missing-table response rather than creating the schema, and exposing connector credentials to the browser would be unsafe.

**How to apply:** Keep schema creation in `supabase/schema.sql`, use the connector for server-side inspection or setup verification, and never place connector credentials in frontend code.