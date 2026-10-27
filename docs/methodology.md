# Measurement methodology — curated-archives-v3

## Unit and time

A signal is one unique verified original publication or original event associated with one or more engineering topics. Weekly counts use the original publication date in UTC, not collection, feed migration, or modification time. Half-open intervals `[start,end)` prevent boundary duplication. The final week can be shorter than seven days. Topic counts are not additive: one publication can concern several topics.

The source registry is a curated publishing sample, not an industry census. Source concentration, publisher interests, access restrictions, feed retention, and source-roster changes affect all measurements. Activity cannot establish developer adoption, effectiveness, engineering quality, consensus, or return on investment.

## Discovery and historical collection

`pnpm collect` reads approved current feeds and indexes and recent authored archive pages. `pnpm collect:backfill` additionally follows bounded feed pagination, publisher post-sitemap shards, and year/month archive indexes over a 180-day window. Date bounds use actual publication evidence. Sitemap `lastmod`, Atom `updated`, and HTTP Last-Modified can prioritize discovery but never become historical publication measurements.

The registry includes original engineering publishers, independent practitioners, and the Model Context Protocol project. GitHub engineering and AI/ML channels share the Microsoft independent group. Hugging Face community/partner namespaces require separately approved publisher identities and are excluded from its editorial source. Vercel product changelogs and translated Cloudflare copies are excluded from the corpus.

A first-party feed/index failure aborts the run before replacing the public dataset. Individual unavailable originals are excluded and recorded for review. On a 401/403 original-page response, the collector stops requesting further originals from that publisher for the run; it does not try to bypass access restrictions. Request timeouts, response sizes, redirect hosts, page counts, candidates, and publisher concurrency are bounded.

## Original publication verification

The original HTTPS page must be retrieved successfully. Canonical attribution must agree with the candidate URL. Server-side HTML parsing isolates the publication body and removes navigation, related stories, footers, and other non-article material before topic matching. Excerpts are verbatim original body text, escaped for display; they remain attributed to their authors. Excerpts do not imply the observatory endorses an author's judgments.

Publication dates prefer original `article:published_time` metadata or Article/BlogPosting JSON-LD. A visible publication date or primary feed publication date can ground a record when original metadata is absent. Missing time-zone precision is represented as a date-only UTC midnight value and explicitly marked `day` precision; exact grounded timestamps are marked `second` precision.

Conflicting original publication days are rejected. Feed/page date disagreements go to review unless an approved, isolated publication header visibly corroborates the original page metadata. In that case the original date is retained, with the raw feed timestamp and literal corroborating header date preserved. This handles republished/migrated feeds without moving old articles into a newer month. Related-article dates cannot serve as corroboration.

New records retain `publicationDateEvidence`, extraction version, exact excerpt, original-content hash, publisher identity, canonical URL, observation time, and verification notes. The provenance date must match the published record. Original pages can later change or disappear; hashes identify the retrieved revision without redistributing full articles.

Topic mapping uses explicit normalized phrases from the versioned topic registry and requires AI/agent context. Broad generic matches such as standalone model context-window specifications or generic evaluation terminology were removed during audit. New topics and ambiguous classifications require review. Automatically admitted records are technical explanations; production usage is never inferred from a tutorial, announcement, or marketing claim.

## Deduplication and source independence

Canonicalization requires HTTPS, removes fragments and tracking parameters, sorts meaningful queries, and normalizes trailing slashes. Canonical URLs make repeated ingestion idempotent. Explicit `originalEventId` values collapse known shared events.

Near-identical long headlines or identical substantial excerpts within seven days are conservatively routed to attribution/duplicate review, rather than automatically counted again. Distinct independently authored discussions of a general technique remain separate observations. This heuristic is not a claim of complete semantic event resolution; original attribution still needs review in ambiguous cases.

Independent source count is the number of distinct publisher groups for the verified observations, not the number of channels, URLs, or authors. Source relationships prevent an organization appearing independent through multiple feeds. The dashboard exposes both contributing groups and publisher concentration.

## Historical coverage and trend direction

Every current archive remains **partial**. Positive counts are verified lower bounds. Missing observations remain `null`; they become measured zero only when **every enabled monitored publisher** has an explicit complete-coverage interval for the measurement window. A successful feed request or a complete interval for one publisher does not establish full-roster completeness.

The current adapters do not create complete intervals. Establishing complete coverage requires reviewed evidence of exhaustive traversal and absence checks across a fixed roster. Consequently the public dashboard withholds percentage changes and directional claims that would require comparable collection. Adding publishers or retrospectively collecting their archives changes totals; dataset growth is not evidence of industry growth. A topic's earliest observation is not its invention date.

Trend calculation splits a selected 30/90/180-day window into equal halves. Without full comparable coverage, direction is `Insufficient coverage`. With comparable coverage, a zero prior baseline and positive current count is `Newly observed` with no percentage; both zero is stable. A baseline of one or two is `Low baseline`. Otherwise rounded percent change is `(current-prior)/prior × 100`: greater than +20% is rising, below −20% declining, otherwise stable. Labels describe observed publishing activity only.

Production-case counts require explicitly reviewed primary evidence of deployed use. Zero classified cases means none verified in this corpus, not no production usage in the world.

## Reproducibility and review

`pnpm validate` validates records and recomputes all 180-day topic snapshots. Snapshots are derived rather than redundantly persisted. Unit/integration tests cover schema references, dates, canonical URLs, source groups, coverage, zero baselines, phrase matching, discovery bounds, attribution review, idempotency, and atomic failure preservation.

`data/backfill-log.json` retains per-source historical audit information independently of routine runs. `data/collection-log.json` describes the latest run. `data/review.json` holds pending date, attribution, and content cases; scoped collection preserves other publishers' pending cases. `npm run audit:coverage` generates a dated publication/source/month snapshot from the dataset. See `source-coverage.md` for the expansion audit.

## Coverage revisions

- v1: OpenAI, Armin Ronacher, Simon Willison, Anthropic, and Mitchell Hashimoto; initial feeds/indexes/authored archives.
- v2: added GitHub Engineering (Microsoft) and AWS Machine Learning (Amazon).
- v3: added LangChain, Hugging Face editorial publications, Vercel Engineering, Cursor, Cloudflare Engineering, and the Model Context Protocol project; expanded existing publisher archives and GitHub AI/ML discovery. Introduced original-body parsing, explicit date provenance/corroboration, duplicate-review heuristics, and bounded manual backfill.
