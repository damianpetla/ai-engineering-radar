import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const d = JSON.parse(await readFile("data/dataset.json", "utf8"));
const baseline = JSON.parse(
  execFileSync("git", ["show", "3ed7149:data/dataset.json"], {
    encoding: "utf8",
  }),
);
const signals = d.signals.filter((s) => s.verificationStatus === "verified");
const count = (items, fn) =>
  items.reduce((out, s) => {
    const key = fn(s);
    out[key] = (out[key] ?? 0) + 1;
    return out;
  }, {});
const publishers = count(signals, (s) => s.sourceId),
  months = count(signals, (s) => s.publishedAt.slice(0, 7)),
  oldMonths = count(baseline.signals, (s) => s.publishedAt.slice(0, 7));
const groups = new Set(
  signals.map(
    (s) => d.sources.find((p) => p.id === s.sourceId).independentGroup,
  ),
);
const topicCounts = d.topics.map((t) => ({
  name: t.name,
  count: signals.filter((s) => s.topicIds.includes(t.id)).length,
}));
const oldest = signals.map((s) => s.publishedAt).sort()[0],
  newest = signals
    .map((s) => s.publishedAt)
    .sort()
    .at(-1);
const share = (Math.max(...Object.values(publishers)) / signals.length) * 100;
const lines = [
  "# Source coverage expansion audit",
  "",
  `Snapshot collected at ${d.updatedAt}. Coverage version: \`${d.coverageVersion}\`. This is a dated audit snapshot; the live dataset can subsequently change.`,
  "",
  `The initial baseline had ${baseline.signals.length} verified publications. This snapshot has **${signals.length} verified publications**, **${groups.size} contributing publisher groups**, and **${topicCounts.filter((t) => t.count > 0).length} observed topics**, dated ${oldest.slice(0, 10)}–${newest.slice(0, 10)}. The largest publisher contributes ${share.toFixed(1)}%.`,
  "",
  "## Observations by publication month",
  "",
  "| Month | Initial corpus | Expanded corpus |",
  "| --- | ---: | ---: |",
  ...Object.keys(months)
    .sort()
    .map((m) => `| ${m} | ${oldMonths[m] ?? 0} | ${months[m]} |`),
  "",
  "Counts are unique verified publications, not developer adoption or effectiveness. Month-to-month changes reflect incomplete collection and the expanded source roster.",
  "",
  "## Approved publishers",
  "",
  "| Publisher | Verified publications | Historical discovery |",
  "| --- | ---: | --- |",
  ...d.sources.map(
    (s) =>
      `| [${s.name}](${s.url}) | ${publishers[s.id] ?? 0} | ${[s.feedUrl ? "Official feed" : "", s.sitemapUrl ? "Publisher sitemap" : "", s.archiveBase ? "Authored monthly archives" : "", s.id === "armin" ? "Authored yearly archive" : "", s.feedPageLimit ? "Bounded feed pagination" : "", s.discoveryUrl ? "Publisher index" : ""].filter(Boolean).join("; ")} |`,
  ),
  "",
  "Hugging Face community/partner namespaces are excluded from its editorial publisher group. GitHub AI/ML and engineering channels share one Microsoft group. Vercel changelogs and translated Cloudflare copies are excluded. Registry membership does not establish publication coverage.",
  "",
  "## Topic evidence",
  "",
  "| Topic | Verified publications |",
  "| --- | ---: |",
  ...topicCounts.map((t) => `| ${t.name} | ${t.count} |`),
  "",
  "One publication can cover multiple topics, so topic counts are not additive. A zero means no verified signal assigned in this corpus; it does not establish a real-world absence.",
  "",
  "## Verification and limitations",
  "",
  "- Every added publication was retrieved from an approved original publisher. Article body text, grounded publication evidence, exact excerpt, content hash, and observation time are retained.",
  "- Feed publication dates that contradict an original page remain in review unless original metadata is corroborated by the literal publication header; both timestamps are retained in that case.",
  "- Sitemap modification dates and Atom updated timestamps are discovery hints, never historical observations.",
  "- All historical coverage remains partial. Rejected pages, archive bounds, title/content filtering, and inaccessible sources limit recall. Missing weeks remain null; trend percentages are withheld.",
  "- A larger retrospective corpus is not evidence of increased industry activity. Source concentration is lower, but the roster is still a curated sample.",
  "- Production usage is not inferred. Automatic records remain technical explanations.",
  "- See `data/backfill-log.json`, `data/collection-log.json`, and `data/review.json` for collection audit and unresolved cases.",
  "",
  "## Reproduce",
  "",
  "Run `npm run audit:coverage` after collection to regenerate this dated audit from the validated dataset. Run `npm run verify` for schema, calculation, extraction, discovery, duplicate-review, and atomic-publication checks.",
  "",
];
await writeFile("docs/source-coverage.md", lines.join("\n"));
console.log(
  JSON.stringify({
    signals: signals.length,
    publishers: groups.size,
    months,
    largestPublisherShare: share.toFixed(1) + "%",
  }),
);
