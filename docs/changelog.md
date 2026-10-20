# Changelog — event-sourced-audit-log

## [0.2.0] - 2026-10-20
### Added
- **Progressive Credential Loading (PCL):** Dynamic auto-promotion between zero-dependency mock fallbacks and live production backends based on environment credentials.
- **Dual Distribution:** Universal OCI container publishing to GitHub Container Registry (`ghcr.io/sumitdalavi/event-sourced-audit-log`) and Helm OCI registries alongside GitHub Release tarballs.
- **Health Reporting:** Exposed `/health` or `/healthz` endpoint with PCL status detection (`mock` vs `live`).
- **Dynamic Reloading:** Support for atomic ConfigMap / secret reloads without requiring pod restarts.
- **Supply Chain Security:** Trivy vulnerability scan gates and SPDX JSON SBOM (`sbom.spdx.json`) generation for all releases.

## [0.1.0] - 2026-10-18
### Added
- Initial baseline service implementation, unit test suites, and CI workflows.

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
