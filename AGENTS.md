# AI Engineering Radar

Product authority: `docs/spec-v1.1.txt` (complete text of `spec.rtf`).

Keep one dashboard with inline topic details and URL state. Trend direction describes observed activity; it never recommends adoption.

Before changing data or calculations, read `docs/methodology.md` and `docs/editorial-policy.md`. Public observations require retrievable primary evidence and grounded publication dates. Keep test fixtures under `tests/`. Unknown coverage is null, never zero.

Before publishing, run `pnpm verify` and `pnpm test:e2e`. Follow `docs/operations.md` for deployment, collection failures, review, and rollback. Keep the last valid dataset when collection fails.
