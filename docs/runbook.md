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
