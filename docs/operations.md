# Operations

## Deployment targets

- Canonical automated hosting: GitHub Pages, `https://damianpetla.github.io/ai-engineering-radar/`.
- Source: `https://github.com/damianpetla/ai-engineering-radar`.
- The public Sites address `https://ai-engineering-radar.luckypin258.chatgpt.site` forwards to the canonical Pages deployment and preserves query/hash state. Its identity is retained in `.openai/hosting.json`. This avoids maintaining a second data snapshot that would diverge from scheduled updates.

## Routine commands

Install with `pnpm install --frozen-lockfile`. Run `pnpm verify` and `pnpm test:e2e` before publication. Playwright needs `pnpm exec playwright install chromium` locally or `--with-deps chromium` on Linux CI. Build output is `dist/`; relative asset URLs support project-path hosting.

## Collection

`pnpm collect` discovers publisher feeds/indexes and authored monthly archives over a bounded 180-day interval. Each request has a 20-second timeout, at most three attempts, host restrictions, a three-megabyte response limit, and bounded entry counts. The crawler does not follow redirects to arbitrary hosts, use credentials, or bypass access restrictions. Archive access was checked against publisher robots policies at onboarding. Recheck policies before adding/changing source adapters.

The workflow runs at 06:17 UTC on every third day of the month (calendar approximation to every 72 hours; resets each month). Manual dispatch: `gh workflow run collect.yml`. It validates and integration-tests the result before committing, then explicitly invokes reusable deployment, which runs desktop and mobile browser tests before publishing. This explicit call matters: commits made with `GITHUB_TOKEN` do not trigger ordinary push workflows. Workflow concurrency prevents overlapping collection.

Feed/index failures abort without replacing `data/dataset.json`. Individual inaccessible or ambiguous pages are excluded, recorded in review, and reflected by partial coverage. CI failures stop publication; GitHub Actions failure notifications and trace artifacts provide diagnostics. Enable account/repository Actions failure notifications for maintainers. The public dashboard marks collections older than seven days overdue.

## Review and corrections

Read `editorial-policy.md` before changing classifications. Review `data/review.json`, fetch original evidence, and update verified records through a pull request. Preserve actual publication dates; date-only timestamps use UTC midnight. A missing original or unsupported claim remains out of metrics. The automatic collector does not classify production cases.

Adding/removing publishers changes comparability. Update registry and coverage version together, document the change, and keep old coverage intervals. Topic IDs/slugs stay stable across display-name changes. Dataset and model validation fail on broken references, duplicate identifiers/URLs, or future publications.

## Failure recovery

1. Inspect failed Actions logs and retained trace/diagnostic artifacts.
2. Reproduce with `pnpm collect` or `pnpm verify` locally. Correct the parser or mark an inaccessible source disabled with a documented coverage change; never bypass a publisher access restriction.
3. Re-run the workflow. The last successful Pages deployment remains public until the entire validation/build/deployment succeeds.
4. To roll back, revert the bad source/data commit, run checks, and push to main; or rerun the deployment workflow from a reviewed correction. Avoid force-pushing public history.

## Secrets and permissions

No model key or external credential is needed for collection. GitHub Pages deployment uses scoped `pages:write` and OIDC `id-token:write`. Collection alone receives `contents:write`; PR validation is read-only. Local `.env*`, build output, browser traces, and dependency directories are ignored. Sites source credentials are short-lived and passed through the helper stdin, never stored in source.

## Delivery verification

Implementation and deployment checks are recorded here after the final production run. A workflow file is configuration, not proof of a successful run.

Initial production build/deployment passed GitHub Actions and returned HTTP 200 over public HTTPS. Initial redundant validation was superseded after a stalled browser download; the final revision is checked independently. Local release checks include 14 domain/integration tests and six desktop/mobile browser tests.

Browser installation uses Playwright’s headless-shell-only mode because tests run headless Chromium. Collection does not install a second browser: reusable deployment owns the browser gate. This removes a redundant large download from every collection run.

## Verified delivery — 27 October 2026

- Public HTTPS dashboard: https://damianpetla.github.io/ai-engineering-radar/ (HTTP 200; desktop and mobile interaction suites passed against production).
- Audited initial corpus: 26 verified original publications across 10 observed topics and four contributing independent publisher groups, dated 6 May–20 October 2026. Seven approved publishers are in the registry; registry membership is not a signal.
- Successful cloud refresh at `2026-10-27T18:17:14.486Z`: all feed/index/archive adapters ran, zero duplicate/new signals were admitted, and verified record identities remained stable.
- Full collection, commit, browser-test, and publication cycle passed: https://github.com/damianpetla/ai-engineering-radar/actions/runs/40558436953 . Its data commit is `73e948d`.
- Release deployment passed: https://github.com/damianpetla/ai-engineering-radar/actions/runs/40558405147 . Earlier audited revision validation passed: https://github.com/damianpetla/ai-engineering-radar/actions/runs/40557450218 .
- 14 domain/integration tests and six browser tests pass locally. Production browser tests cover both viewport sizes, URL refresh/history, inline expansion, range/search/dialog controls, HTTPS evidence, runtime errors, and page overflow.
- Independent Python counting audit confirmed 26 unique primary URLs and per-topic publisher/count totals against the domain aggregation.

Main-branch validation runs type/schema/domain/integration checks. Deployment owns the main-branch browser gate; PR validation additionally runs browsers before merge. This avoids duplicating browser downloads on every main-branch commit while retaining browser checks before production publication.

All historical coverage remains partial. Initial trend percentages are intentionally unavailable. One independent practitioner contributes most of the corpus; the source dialog exposes concentration. OpenAI original pages currently deny the collector, so their feed candidates remain review-only. AWS’s available candidate excerpt did not match its primary page and was excluded. Automatic collection never asserts production usage.

## Expanded historical collection

Run `pnpm collect:backfill` for bounded historical traversal, or scope a diagnostic pass with `pnpm collect:backfill -- --sources=langchain,cursor`. Source IDs must exist and be enabled. `pnpm collect` remains the incremental scheduled path. Manual cloud backfill: `gh workflow run collect.yml -f backfill=true`. Collection has a 45-minute workflow limit; each source also has candidate/page bounds, two concurrent original-page fetches, 20-second request timeouts, and an eight-megabyte streaming response cap for long feeds.

Inspect `data/backfill-log.json` for the most recent per-source backfill audits, `data/collection-log.json` for the latest run, and `data/review.json` for date/attribution/content failures. Partial scoped runs retain pending review cases for other publishers. A same-host redirect is permitted; a redirect to a different publisher is excluded. Source selectors, URI bounds, and publication-header selectors are versioned in the registry. On extractor changes, run the extraction/discovery/integration tests before collecting or publishing.

Current roster, historical counts, and limitations are documented in `source-coverage.md`. The original delivery's 26-record statistics above are a historical baseline, not the expanded dataset size.

Expanded collection stops a publisher's remaining original-page requests after encountering access denial (401/403), while retaining its partial-coverage warning. Complete-coverage measurements require the entire enabled publisher roster, not a single successful source.

The expansion's cross-publisher audit excluded a secondary Simon Willison report about Anthropic source control in favor of the original Anthropic publication. Its shared event identity and review adjustment are retained. A full incremental run added zero duplicate records after backfill. See the dated source-coverage audit for final counts; the earlier 26-publication delivery statistics remain historical context.

CI browser setup checks for the runner's preinstalled Google Chrome and selects Playwright's `chrome` channel when available; if absent, it installs the headless Chromium shell. Local tests keep using the bundled Playwright browser. This removes repeated external browser downloads from the normal publication path while preserving all desktop/mobile checks. The standard runner browser inventory is documented by [GitHub runner-images](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md).
