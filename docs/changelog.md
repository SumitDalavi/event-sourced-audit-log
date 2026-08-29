# Changelog — event-sourced-audit-log

## [2026-08-29] — Phase 0 fixes (Portfolio Action Plan)
### Fixed
- `tests/api.test.js`: `pool.query` mock now returns `{ rows: [] }` instead of `undefined`. Eliminates the `TypeError: Cannot read properties of undefined (reading 'rows')` console error that fired during passing tests even though tests passed. Root cause: `updateSnapshot()` calls `pool.query` (the outer pool), not the transaction client — the mock only stubbed the client's query method.
### Added
- `docs/architecture.md`: Expanded from 22-line placeholder to full Mermaid diagram, component table, data model DDL, dependency honesty table, and engineering decisions.
- `docs/runbook.md`: New — prerequisites, quick start (mocked and real Postgres), exact test commands with expected output, API usage examples, failure mode troubleshooting.
- `docs/decisions.md`: New — four ADRs covering hash chaining, advisory lock, test/prod DB split, async projection.
- `docs/changelog.md`: New (this file).

## [Pre-2026-08-29] — Initial implementation
### Added
- Core event sourcing implementation: `POST /events` with hash chaining and `pg_advisory_xact_lock` serialization
- `updateSnapshot()` async projection builder
- Jest test suite with mocked `pg` (2 tests)
- Docker support (`Dockerfile`)
