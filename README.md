# AI Engineering Radar

[Open the live dashboard](https://damianpetla.github.io/ai-engineering-radar/) · [Source repository](https://github.com/damianpetla/ai-engineering-radar)

A public, evidence-based observatory of AI engineering practices. One analytical dashboard, real source evidence, transparent historical coverage, no adoption recommendations.

Product authority: [specification 1.1](docs/spec-v1.1.txt). [Architecture](docs/architecture.md) · [Methodology](docs/methodology.md) · [Evidence policy](docs/editorial-policy.md) · [Operations](docs/operations.md).

## Local development

Requires Node.js 22+ and pnpm 10.10.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The single root package runs the workspace. `npm run <script>` also works after dependencies are installed.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm collect
pnpm validate
```

Collection requires public network access and no API keys. The pipeline fetches bounded, permitted public sources, retains only grounded excerpts, and routes ambiguous material to review. Feed discovery failure stops the run before replacing the last valid public dataset. All initial archives are marked partial; empty historical intervals are not fabricated zero counts. Automatic classification never claims production usage.

## Layout

`apps/web` — responsive dashboard and URL interaction. `packages/domain` — validated records and deterministic calculations. `packages/pipeline` — ingestion and validation. `data` — source-backed records and coverage. `tests` — isolated synthetic fixtures and browser checks. `docs` — product, evidence, architecture, and operations.

## Hosting and automation

`dist/` is portable static output. The Sites forwarding address is declared in `.openai/hosting.json`. GitHub Actions files configure validation, Pages deployment, and collection approximately every three days, with manual dispatch. Activation and verified status are tracked in [operations](docs/operations.md). Do not assume that workflow files alone establish that automation is running.

Shareable selection: `/?topic=mcp-tool-integration`. With project-path hosting, retain the project path before the query string. No external service credentials are shipped to the browser. Optional infrastructure costs require owner approval.
