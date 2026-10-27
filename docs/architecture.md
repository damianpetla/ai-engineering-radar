# Architecture

Static-first React + TypeScript application built with Vite. A pnpm workspace contains web, domain, and pipeline packages with explicit package manifests; the root owns shared development tooling and commands. This is simpler than adding Astro around a single fully interactive dashboard. There is no application server, database, account system, CMS, or model API dependency.

- `packages/domain/src/index.ts`: strict Zod records, referential checks, canonical URLs, topic phrase matching, deduplication, UTC intervals, snapshots, trend direction, URL decoding.
- `packages/pipeline/src/collect.ts`: orchestrates collection, preserves review/backfill audit records, and atomically replaces the validated public dataset.
- `packages/pipeline/src/discover.ts`: bounded feed pagination, publisher indexes, sitemap shards, and authored year/month archives; partner namespaces and translated duplicates are excluded.
- `packages/pipeline/src/extract.ts`: server-only Cheerio parsing isolates article bodies, grounds publication dates, and extracts verbatim evidence. Modification timestamps are discovery hints only.
- `packages/pipeline/src/fetch.ts`: publisher-host-restricted requests, bounded same-host redirects, retries, timeouts, and streaming response limits.
- `packages/pipeline/src/verification.ts`: conservative headline/excerpt similarity routes possible duplicate events or syndication to review.
- `packages/pipeline/src/validate.ts`: checks persisted data and recomputes every 180-day topic snapshot.
- `apps/web/src`: dashboard presentation and URL interaction. The dataset is a separate lazy-loaded immutable build asset and validated again before display.
- `data`: version-controlled registry, topics, verified observations, coverage, review queue, run logs.
- `tests`: synthetic fixtures only; never imported into production.

Rendering uses native SVG to avoid a heavy chart dependency. Chart dots expose source counts through titles, focusable week overlays, a live tooltip, and accessible text data. Null intervals break the line. The final weekly bucket can be shorter than seven days and is documented in the methodology.

The application is portable static output in `dist/`. GitHub Pages provides canonical public HTTPS hosting and automatic publishing. The Sites address redirects to that canonical deployment, retaining topic query state. No GitHub secret is needed for Pages: the workflow uses short-lived repository/OIDC permissions.

Source metadata, data, and application state are separate. Raw external HTML is never rendered. Excerpts are plain strings escaped by React; outbound evidence links are HTTPS. Model extraction is deliberately omitted: deterministic extracts currently satisfy the evidence requirement with fewer failure modes. Any later model extractor must have versioned prompts and keep its output in review until verified.
