# Operations

## Deployment targets

- Canonical automated hosting: GitHub Pages, `https://damianpetla.github.io/ai-engineering-radar/`.
- Source: `https://github.com/damianpetla/ai-engineering-radar`.
- Sites hosting identity is retained in `.openai/hosting.json` for a secondary published snapshot. The Sites source remote is separate from GitHub. GitHub schedules update Pages; they do not automatically update a Sites snapshot.

## Routine commands

Install with `pnpm install --frozen-lockfile`. Run `pnpm verify` and `pnpm test:e2e` before publication. Playwright needs `pnpm exec playwright install chromium` locally or `--with-deps chromium` on Linux CI. Build output is `dist/`; relative asset URLs support project-path hosting.

## Collection

`pnpm collect` discovers publisher feeds/indexes and authored monthly archives over a bounded 180-day interval. Each request has a 20-second timeout, at most three attempts, host restrictions, a three-megabyte response limit, and bounded entry counts. The crawler does not follow redirects to arbitrary hosts, use credentials, or bypass access restrictions. Archive access was checked against publisher robots policies at onboarding. Recheck policies before adding/changing source adapters.

The workflow runs at 06:17 UTC on every third day of the month (calendar approximation to every 72 hours; resets each month). Manual dispatch: `gh workflow run collect.yml`. It validates and browser-tests the result before committing, then explicitly invokes reusable deployment. This explicit call matters: commits made with `GITHUB_TOKEN` do not trigger ordinary push workflows. Workflow concurrency prevents overlapping collection.

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
