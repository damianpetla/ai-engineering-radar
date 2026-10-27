# Source coverage expansion audit

Snapshot collected at 2026-10-27T18:45:34.865Z. Coverage version: `curated-archives-v3`. This is a dated audit snapshot; the live dataset can subsequently change.

The initial baseline had 26 verified publications. This snapshot has **252 verified publications**, **11 contributing publisher groups**, and **11 observed topics**, dated 2026-05-04–2026-10-27. The largest publisher contributes 39.7%.

## Observations by publication month

| Month | Initial corpus | Expanded corpus |
| --- | ---: | ---: |
| 2026-05 | 4 | 32 |
| 2026-06 | 6 | 50 |
| 2026-07 | 5 | 39 |
| 2026-08 | 5 | 47 |
| 2026-09 | 1 | 30 |
| 2026-10 | 5 | 54 |

Counts are unique verified publications, not developer adoption or effectiveness. Month-to-month changes reflect incomplete collection and the expanded source roster.

## Approved publishers

| Publisher | Verified publications | Historical discovery |
| --- | ---: | --- |
| [OpenAI](https://openai.com) | 0 | Official feed |
| [Armin Ronacher](https://lucumr.pocoo.org) | 9 | Official feed; Authored yearly archive |
| [Simon Willison](https://simonwillison.net) | 27 | Official feed; Authored monthly archives |
| [Anthropic](https://www.anthropic.com) | 13 | Publisher sitemap; Publisher index |
| [Mitchell Hashimoto](https://mitchellh.com) | 0 | Official feed |
| [GitHub Engineering](https://github.blog) | 6 | Official feed; Bounded feed pagination |
| [AWS Machine Learning](https://aws.amazon.com) | 8 | Official feed |
| [LangChain](https://www.langchain.com) | 100 | Official feed; Publisher sitemap |
| [Hugging Face](https://huggingface.co) | 10 | Official feed |
| [Vercel Engineering](https://vercel.com) | 19 | Official feed |
| [Cursor](https://cursor.com) | 26 | Publisher sitemap; Publisher index |
| [Cloudflare Engineering](https://blog.cloudflare.com) | 28 | Official feed; Publisher sitemap |
| [Model Context Protocol project](https://blog.modelcontextprotocol.io) | 6 | Official feed |

Hugging Face community/partner namespaces are excluded from its editorial publisher group. GitHub AI/ML and engineering channels share one Microsoft group. Vercel changelogs and translated Cloudflare copies are excluded. Registry membership does not establish publication coverage.

## Topic evidence

| Topic | Verified publications |
| --- | ---: |
| Context engineering | 25 |
| Harness engineering | 52 |
| Agentic coding | 111 |
| Agent evaluation | 23 |
| Multi-agent orchestration | 70 |
| Agent sandboxing | 77 |
| AI-assisted code review | 29 |
| Agent memory | 14 |
| MCP tool integration | 73 |
| AI-native testing | 0 |
| Agent tool design | 52 |
| Agent security | 18 |

One publication can cover multiple topics, so topic counts are not additive. A zero means no verified signal assigned in this corpus; it does not establish a real-world absence.

## Verification and limitations

- Every added publication was retrieved from an approved original publisher. Article body text, grounded publication evidence, exact excerpt, content hash, and observation time are retained.
- Feed publication dates that contradict an original page remain in review unless original metadata is corroborated by the literal publication header; both timestamps are retained in that case.
- Sitemap modification dates and Atom updated timestamps are discovery hints, never historical observations.
- All historical coverage remains partial. Rejected pages, archive bounds, title/content filtering, and inaccessible sources limit recall. Missing weeks remain null; trend percentages are withheld.
- A larger retrospective corpus is not evidence of increased industry activity. Source concentration is lower, but the roster is still a curated sample.
- Production usage is not inferred. Automatic records remain technical explanations.
- See `data/backfill-log.json`, `data/collection-log.json`, and `data/review.json` for collection audit and unresolved cases.

## Reproduce

Run `npm run audit:coverage` after collection to regenerate this dated audit from the validated dataset. Run `npm run verify` for schema, calculation, extraction, discovery, duplicate-review, and atomic-publication checks.
