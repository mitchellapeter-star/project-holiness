---
name: Structured A3 storage
description: Why linked A3 problems and countermeasures use JSON in the existing Supabase text fields.
---

Store structured A3 Problems and linked Countermeasures as JSON arrays in the existing user-scoped A3 text columns, while treating legacy plain text as one imported Problem or Countermeasure.

**Why:** This adds relational behavior in the client without another database migration, preserves existing A3 content, and keeps the current RLS and one-row-per-user A3 model intact.

**How to apply:** Keep parsing backward-compatible with plain text. Any future fields added to these structures should remain optional during parsing so existing saved JSON continues to load.