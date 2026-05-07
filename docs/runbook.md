# Ingestion Runbook

Operational guide for the sykkelpris ingestion pipeline.

---

## How the pipeline runs

The ingestion job runs automatically every night at **03:00 UTC** via GitHub Actions
(`.github/workflows/ingest.yml`). It scrapes all active stores, upserts listings into
the database, and marks listings not seen in the current run as inactive.

Listings older than 7 days (not seen in any recent run) are excluded from all catalog
queries automatically — no manual cleanup needed.

---

## Trigger a full ingestion run manually (all stores)

1. Go to the repository on GitHub.
2. Click **Actions** → **Ingest** in the left sidebar.
3. Click **Run workflow** (top right of the workflow runs list).
4. Leave the **Store slug** field blank.
5. Click **Run workflow**.

The run appears in the list within a few seconds. Click it to watch live logs.

---

## Trigger ingestion for a single store

Same steps as above, but enter the store slug in the **Store slug** field before
clicking **Run workflow**.

Example slugs: `canyon`, `bikester`, `unaas`, `sykkeloutlet`, `poie`

The store slug must match the `slug` column in the `Store` table exactly.

---

## Check whether the nightly ingestion succeeded

1. Go to **Actions** → **Ingest** on GitHub.
2. The most recent run is at the top. A green checkmark = success, red X = failure.
3. Click the run → click the **ingest** job → expand **Run ingestion** to see full logs.
4. The **Step Summary** tab shows the last 30 lines of log output — enough to confirm
   which stores ran and how many listings were processed.

**GitHub does not send failure notifications by default.** Check the Actions tab after
each nightly window (03:00–04:00 UTC) if freshness is critical. Post-launch, configure
failure email or Slack notifications in the repository notification settings.

---

## What to check if listings look stale or disappear

**Step 1 — Confirm the last run succeeded.**
Go to Actions → Ingest and check the most recent run status and timestamp.

**Step 2 — Check the Step Summary for the affected store.**
Look for the store slug in the log. Confirm `X listings upserted` is non-zero.

**Step 3 — Trigger a manual re-run for the affected store.**
Use the single-store dispatch described above. Watch the live log for errors.

**Step 4 — Check the database directly.**
A listing disappears from the catalog if:
- `isActive = false` (scraper stopped returning it), or
- `lastSeenAt` is older than 7 days (stale threshold), or
- It fails `listingEligibility()` (no image, discount < 5%, etc.)

Run `npx prisma studio` to inspect listings for a specific store.

**Step 5 — Check the store's source URL manually.**
Open the store's products feed or sale page in a browser. If the source is down or
the discount structure changed, the scraper will return zero results for that store.

---

## Run ingestion locally

Prerequisites: `.env` with `DATABASE_URL` and `DIRECT_URL` set.

**All active stores:**
```bash
npm run ingest
```

**Single store:**
```bash
npm run ingest -- <store-slug>
# Example:
npm run ingest -- canyon
```

The `--` separator passes the slug as `process.argv[2]` to `scripts/run-ingestion.ts`.

---

## Ingestion script reference

| Script | Command | What it does |
|--------|---------|--------------|
| `npm run ingest` | `npx tsx scripts/run-ingestion.ts` | Run all active stores |
| `npm run ingest -- <slug>` | Same with store arg | Run one store |
| `npm run db:seed` | `tsx prisma/seed.ts` | Seed store records |
| `npm run db:studio` | `prisma studio` | Browse the database |
