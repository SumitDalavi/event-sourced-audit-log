# Runbook — event-sourced-audit-log
> Last updated: 2026-08-29

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Docker + Compose | Any recent | For real Postgres path only |

## Quick Start (in-memory / mocked Postgres — no Docker needed)

```bash
# From the event-sourced-audit-log/ directory
npm install
node index.js
# Server starts on http://localhost:3000
```

## Quick Start (real Postgres via shared infra)

```bash
# 1. Start shared infra from workspace root (first time only)
docker compose -f ../docker-compose.infra.yml up -d postgres

# 2. The audit_log database is created automatically by the init script.
#    Set the connection string:
export DATABASE_URL="postgres://portfolio:portfoliopass@localhost:5432/audit_log"

# 3. Start the service
npm install
node index.js
```

## Run Tests

```bash
npm test
```

Expected output:
```
PASS tests/api.test.js
  Event Sourced Audit Log
    ✓ appends genesis event with GENESIS previous_hash (207 ms)
    ✓ chains subsequent events with valid crypto hashes (5 ms)

Tests: 2 passed, 2 total
```

> **Note:** Tests use a mocked `pg` client — no database connection required.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@localhost:5432/db` | Postgres connection string |
| `PORT` | `3000` | HTTP server port |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/events` | Append a new event to the ledger |

### Append an event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "user_123",
    "event_type": "USER_CREATED",
    "payload": { "name": "Alice", "email": "alice@example.com" },
    "schema_version": "1.0"
  }'
```

Response:
```json
{ "status": "appended", "hash": "abc123..." }
```

### Chain a second event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "user_123",
    "event_type": "EMAIL_UPDATED",
    "payload": { "email": "alice.new@example.com" },
    "schema_version": "1.0"
  }'
```

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `ECONNREFUSED 5432` | Postgres not running | Run `docker compose -f ../docker-compose.infra.yml up -d postgres` |
| `TypeError: Cannot read 'rows'` | Fixed in 2026-08-29 patch (pool.query mock) | Pull latest code |
| `Pool error: role does not exist` | Wrong `DATABASE_URL` credentials | Set `DATABASE_URL` to the shared infra credentials |

## Verify Hash Chain Integrity

The hash chain is tamper-evident. To verify manually:

1. Retrieve all events for an entity from `event_ledger` ordered by `id ASC`
2. Compute SHA-256 of `JSON.stringify({ entity_id, event_type, payload, schema_version, previous_hash })` for each event
3. Compare computed hash to stored `hash` — any mismatch indicates tampering

## Release Runbook

### Triggering a New Release
Releases are automated via GitHub Actions (`.github/workflows/release.yml`) and trigger whenever a semantic version tag is pushed:

```bash
# 1. Ensure master is clean and up-to-date
git checkout master
git pull origin master

# 2. Tag the release
git tag -a v0.1.0 -m "Release v0.1.0"

# 3. Push the tag to trigger the pipeline
git push origin v0.1.0
```

### Release Pipeline Stages
1. **Test Verification:** Runs project test suite gates prior to container build.
2. **Container Image Build:** Builds the production container image (`ghcr.io/sumitdalavi/event-sourced-audit-log:<tag>`).
3. **Trivy Vulnerability Scan:** Scans the built container for CRITICAL and HIGH CVEs via Aqua Security Trivy.
4. **Anchore Syft SBOM Generation:** Creates an SPDX JSON Software Bill of Materials (`sbom.spdx.json`).
5. **GitHub Release Publishing:** Creates the release with auto-generated release notes and attaches `sbom.spdx.json`.

### Verifying the Release
```bash
# Check workflow run status
gh run list --workflow=release.yml --repo SumitDalavi/event-sourced-audit-log

# Inspect the published release and attached assets
gh release view v0.1.0 --repo SumitDalavi/event-sourced-audit-log

# Download and inspect the SBOM
gh release download v0.1.0 --repo SumitDalavi/event-sourced-audit-log -p "sbom.spdx.json"
cat sbom.spdx.json | jq .spdxVersion
```

### Release Failure Modes
| Symptom | Cause | Resolution |
|---|---|---|
| `Unable to resolve action ... unable to find version` | Pinned action tag missing or upstream tag modified | Pin action to a verified release tag (`@v0.36.0`) or commit SHA |
| `invalid reference format: repository name must be lowercase` | Container repository owner contains uppercase characters | Lowercase the repository owner before tagging (`tr '[:upper:]' '[:lower:]'`) |
| `File not found: sbom.spdx.json` during release step | SBOM action configured with `artifact-name` instead of `output-file` | Ensure `output-file: sbom.spdx.json` is set in Anchore action |
