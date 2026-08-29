# Architecture Decision Records — event-sourced-audit-log
> Last updated: 2026-08-29

---

## ADR-001: SHA-256 Hash Chaining for Tamper-Evidence

**Date:** Pre-2026-08-29  
**Status:** Accepted

**Context:**  
A compliance audit log must be tamper-evident. If a record is altered, that alteration must be detectable without requiring a trusted third party.

**Decision:**  
Each event stores a SHA-256 hash computed over its own data plus the hash of the previous event (`previous_hash`). The first event uses the sentinel value `'GENESIS'`. This creates a cryptographic chain — altering any event invalidates all subsequent hashes.

**Consequences:**  
- ✅ Tamper detection is purely computational — no external dependency  
- ✅ Chain can be re-verified by any client with access to the event data  
- ⚠️ Re-keying events (e.g., schema migration) breaks the chain and requires a re-hash procedure  
- ⚠️ Does not protect against a compromised database user who re-computes all hashes after alteration

---

## ADR-002: `pg_advisory_xact_lock` for Per-Entity Serialization

**Date:** Pre-2026-08-29  
**Status:** Accepted

**Context:**  
Two concurrent writes for the same `entity_id` would read the same `previous_hash`, producing two events with identical chain positions and breaking the monotonic chain.

**Decision:**  
Use `pg_advisory_xact_lock(hash_int)` where `hash_int` is derived from `MD5(entity_id)`. This serializes all writes for a given entity within a Postgres transaction, without a separate distributed lock service.

**Consequences:**  
- ✅ Zero external dependencies for concurrency control  
- ✅ Lock is automatically released on transaction commit/rollback  
- ⚠️ MD5 collision (two different `entity_id` values map to same `hash_int`) would cause unrelated entities to serialize — acceptable risk given the 2^31 lock space

---

## ADR-003: Mocked `pg` in Tests, Real Postgres in Production

**Date:** 2026-08-29  
**Status:** Accepted

**Context:**  
Integration tests that require a real Postgres instance fail in CI environments without database provisioning. The V3 audit flagged this as a gap.

**Decision:**  
Tests use a full in-process `pg` mock that returns deterministic rows. The real Postgres path is exercised via `docker-compose.infra.yml` (shared portfolio infra) using the `audit_log` database. Both paths are documented in `docs/runbook.md`.

**Consequences:**  
- ✅ Tests run anywhere without Docker  
- ✅ Real Postgres path is available for integration testing  
- ⚠️ The mock does not exercise Postgres RLS, advisory locks, or WAL behavior — those require real DB testing

---

## ADR-004: Async Projection Update (Fire-and-Forget)

**Date:** Pre-2026-08-29  
**Status:** Accepted

**Context:**  
`updateSnapshot()` rebuilds a read-model projection after each event. If it runs synchronously in the write path, a slow projection slows all writes.

**Decision:**  
Call `updateSnapshot(entity_id).catch(console.error)` — fire-and-forget. The write response is returned immediately after the event is appended; projection update happens asynchronously.

**Consequences:**  
- ✅ Write latency is not coupled to projection latency  
- ⚠️ Read-model may lag briefly after a write  
- ⚠️ Projection errors are logged but do not fail the write — monitor logs for `[projection error]`
