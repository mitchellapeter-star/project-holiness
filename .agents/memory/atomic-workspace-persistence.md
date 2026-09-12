---
name: Atomic workspace persistence
description: Durable rules for preventing stale or partial Project Holiness sessions from overwriting Supabase data.
---

Authenticated browser clients may read workspace tables directly, but all writes must go through the revision-checked transactional entry point. Loads must also use one database snapshot. Deletions are allowed only when explicitly identified by the client, and stale revisions must fail instead of overwriting newer data.

**Why:** A partial authenticated load once paired empty local state with successful collection reads, and a stale published client then issued bulk deletes. Separate table requests and direct browser writes also left races that a client-only autosave guard could not fully prevent.

**How to apply:** Keep workspace tables SELECT-only under browser RLS. Preserve the transaction function's explicit user scoping, ownership validation, empty search path, atomic boundary, and expected-revision check. Serialize client saves and stop on revision conflict.

Expose the browser save operation as one JSON payload rather than calling the internal multi-argument function from the client.

**Why:** One payload keeps the browser contract stable while the database transaction validates and persists the complete snapshot and explicit deletions.

**How to apply:** Keep the multi-argument function as the internal transactional implementation and have the browser-facing entry point unpack one JSON payload into it.

Use an insert-only command table with a trigger for browser saves; do not depend on PostgREST RPC routing for this project.

**Why:** PostgREST 404 responses masked an internal SQLSTATE 42883 error caused by schema-qualifying `COALESCE`. A regular table route plus full error-body inspection made the real transaction failure observable.

**How to apply:** Permit authenticated inserts into the command table under RLS. In a security-definer trigger, verify `auth.uid()`, delegate to the atomic transaction, clear the payload before storage, and return the new revision. Never synchronously delete older receipts in an insert trigger; concurrent saves can deadlock.

Return stale-revision conflicts as explicit HTTP 409 errors, not SQLSTATE 40001.

**Why:** Infrastructure may treat 40001 as a retryable serialization failure; a permanently stale expected revision can then retry or hang instead of reaching the client.

**How to apply:** Raise PostgREST SQLSTATE `PT409` with the `workspace_conflict` message. The client must block further edits visibly, flush pending saves before sign-out, and bound retries to genuinely transient failures.

Start completion saves without a remote user lookup, and keep an unload-safe copy of an unsaved mutation.

**Why:** A daily checkbox update once entered local state, but an immediate refresh aborted the preliminary authentication request before the save POST began. The database row was never created even though the checkbox had appeared checked.

**How to apply:** Use the already-hydrated user ID for the command payload and rely on RLS plus the trigger's `auth.uid()` validation. On `pagehide`, send the same revision-checked command with `fetch(..., { keepalive: true })`; duplicate submissions are safe because one wins and the other conflicts.