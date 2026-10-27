# Delivery ledger

- M0: foundation — TypeScript, validated records, deterministic metrics, tests, documentation.
- M1: dashboard — responsive chart, topic rows, inline evidence, shareable URL, accessibility.
- M2: evidence — verified feeds, bounded extraction, conservative review, authentic backfill, reproducibility.
- M3: operations — public deployment, CI, scheduled collection, verified publication cycle.

Acceptance evidence and remaining external dependencies are recorded in `docs/operations.md` as delivery progresses.

## Verified locally

M0/M1: TypeScript checks, 13 domain/pipeline tests, six Playwright tests across desktop and mobile, and production Vite build passed. The dashboard contains only verified production records. Browser checks cover inline selection, shared URLs, refresh/back behavior, unknown slugs, range switching, search, dialogs, HTTPS evidence links, and no horizontal overflow.

M2: real feed/index and authored archive collection is running; initial real records span May–October 2026. Further pagination audit and repeat-run checks precede final acceptance.

M2 local acceptance: 180-day authored archive traversal follows discovered pagination, limited to eight pages per month. Source audit tightened generic evaluation/context-window matches. A repeated live collection added zero records; a subprocess integration test confirms stable signal records across repeated runs and byte-for-byte preservation of the public dataset on failed feed retrieval.

M3 acceptance: public HTTPS deployment verified on desktop/mobile; CI build/validation passed; scheduled collection was manually exercised in GitHub Actions and completed through data commit `73e948d` and public deployment. Schedule remains enabled at 06:17 UTC every third calendar day. Operational recovery, evidence review, source concentration, partial coverage, and access limitations are documented in `operations.md`.
