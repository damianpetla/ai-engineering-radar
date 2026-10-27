# Measurement methodology — curated-feeds-v1

## Unit and time

A signal is one unique verified original publication. The chart counts signals by publisher-supplied publication date in UTC, not collection date. Weekly half-open intervals `[start, end)` prevent boundary duplication; the last bucket is truncated at the successful collection timestamp. One publication can match multiple topics; adding topic totals therefore does not give the number of unique publications.

The source registry is a curated sample, not an industry census. Source groups identify publishers, so multiple channels from an organization cannot inflate independent-source counts. The dashboard exposes publisher counts and concentration. Publication frequency, publisher interests, access restrictions, and feed retention all bias this sample.

## Collection and verification

RSS/Atom provides grounded publication timestamps and original links. The collector retrieves the original page and checks that the initial feed excerpt appears in its text. Publisher engineering indexes supply additional discovery. Their article publication metadata grounds dates; the original page description supplies a verbatim excerpt. Neither sitemap modification dates nor HTTP Last-Modified establish publication time.

Current matching uses whole normalized phrases from the versioned topic registry. It does not infer effectiveness, deployability, or production use. All automatically admitted observations are classified as technical explanations. Ambiguous attribution, missing timestamps, inaccessible originals, or unsupported extracts are excluded and recorded in `data/review.json`. A failed source feed/index aborts the entire run; inaccessible individual articles are recorded, excluded, and covered by the partial-coverage warning.

Excerpt text is publisher-authored and may contain the author's judgments. The observatory attributes it as an excerpt rather than adopting it as its own assessment.

## Deduplication

Canonicalization requires HTTPS, removes fragments and known tracking parameters, sorts query parameters, and normalizes trailing slashes. Canonical URLs deduplicate repeated ingestion. Explicit `originalEventId` values deduplicate multiple accounts of an event. Known secondary quotation/linkblog patterns go to review rather than automatic publication. Similarity and attribution judgments remain a review responsibility; current literal matching does not claim semantic deduplication. The bounded, first-party source set reduces but does not eliminate this risk.

## Coverage

Every initial archive is partial. Positive weekly counts are verified lower bounds. Weeks without a verified signal are `null` unless a source has an explicit complete-coverage interval. Partial coverage does not imply a zero. The existence of a source in the registry does not imply it contributed evidence.

A complete-coverage interval can be recorded only after the collector's exhaustive traversal and absence checks are verified for that interval. The current adapters never create complete intervals. Consequently initial trend labels correctly show insufficient coverage instead of unsupported increases.

Adding a source requires a new coverage version and a note in the registry history. A topic's first observation is not its invention date. Historical collection is limited to 180 days when credible publication dates are available; older evidence is not shifted forward or synthesized.

## Trend rules

Split the selected 30/90/180-day interval into two equal halves. Counts use the same verified records and deduplication as snapshots. Without a complete comparable collection interval, direction is `Insufficient coverage`. Null counts are also insufficient. A zero prior baseline with positive current count is `Newly observed`, with no percentage; both zero is stable. A prior baseline of one or two is `Low baseline`, with no percentage. Otherwise percent change is `(current-prior)/prior × 100`, rounded to the nearest integer. Greater than +20% is rising, below −20% declining, and the remainder stable. These rules are descriptive only.

## Production evidence

Production-case counts require documented use and explicit reviewed classification. No automatically extracted post becomes a production case merely because it says "production". Zero classified production cases means none verified in this dataset, not no production usage in the world.

## Reproducibility

`npm run validate` validates data and recomputes all snapshots. Snapshots are derived on demand and not redundantly persisted. `contentHash`, `excerpt`, retrieval timestamp, original URL, coverage version, and verification notes preserve provenance. Original content can later change or disappear; hashes document the retrieved revision without redistributing full articles.
