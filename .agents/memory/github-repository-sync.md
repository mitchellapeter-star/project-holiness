---
name: GitHub repository synchronization
description: Durable constraints for synchronizing this workspace with its GitHub repository.
---

Use the authenticated GitHub REST connection when Git CLI authentication is unavailable. Upload the complete tracked tree through the Git Data API and verify every remote path, mode, and blob SHA against the local Git tree.

**Why:** Both available GitHub connections were healthy but did not provide usable HTTPS credentials to `git push`. The standard OAuth connection did provide repository-write API access. GitHub also rejects Git Data blob creation before an empty repository has its first commit, and Replit's connector proxy limits requests to 10 per second.

**How to apply:** Initialize a truly empty repository with a temporary first commit, wait until its ref is visible, then create content-addressed blobs in batches below 10 requests per second. Build a complete tree without the temporary file, create the commit on `main`, update the ref, and compare remote path/mode/blob tuples to the local tracked tree before reporting success.