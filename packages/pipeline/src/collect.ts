import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  DatasetSchema,
  SourceSchema,
  TopicSchema,
  canonicalUrl,
  deduplicate,
  type Dataset,
  type Signal,
} from "../../domain/src/index";
import { fetchText } from "./fetch";
import { possibleDuplicate } from "./verification";
import { discover } from "./discover";
import {
  extractArticle,
  engineeringTopics,
  isCandidate,
  type Candidate,
} from "./extract";
export { parseFeed, plain } from "./extract";
const EXTRACTION_VERSION = "article-body-v3";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
async function run() {
  const sources = SourceSchema.array().parse(
    JSON.parse(await readFile("data/sources.json", "utf8")),
  );
  const topics = TopicSchema.array().parse(
    JSON.parse(await readFile("data/topics.json", "utf8")),
  );
  let previous: Dataset | undefined;
  try {
    previous = DatasetSchema.parse(
      JSON.parse(await readFile("data/dataset.json", "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const backfill = process.argv.includes("--backfill"),
    selected = process.argv
      .find((v) => v.startsWith("--sources="))
      ?.split("=")[1]
      .split(",");
  if (selected?.some((id) => !sources.some((s) => s.id === id && s.enabled)))
    throw new Error("Unknown or disabled source selection");
  const observedAt = new Date().toISOString(),
    cutoff = Date.parse(observedAt) - 180 * 86400000;
  const signals: Signal[] = [...(previous?.signals ?? [])],
    known = new Set(signals.map((s) => canonicalUrl(s.canonicalUrl)));
  const activeSources = new Set(
    sources
      .filter((s) => s.enabled && (!selected || selected.includes(s.id)))
      .map((s) => s.id),
  );
  let pendingReview: { sourceId: string; url?: string; reason: string }[] = [];
  try {
    pendingReview = JSON.parse(await readFile("data/review.json", "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const review = pendingReview.filter(
    (r) =>
      !activeSources.has(r.sourceId) &&
      (!r.url || !known.has(canonicalUrl(r.url))),
  );
  const logs: Record<string, unknown>[] = [];
  const coverage = [...(previous?.coverage ?? [])];
  for (const source of sources.filter(
    (s) => s.enabled && (!selected || selected.includes(s.id)),
  )) {
    console.log(
      `Discovering ${source.name} (${backfill ? "historical backfill" : "incremental"})…`,
    );
    const discovery = await discover(source, backfill, cutoff);
    let added = 0,
      examined = 0,
      outsideWindow = 0,
      unmatched = 0,
      accessRestricted = false;
    const candidates = discovery.candidates.filter((c) => {
      if (known.has(canonicalUrl(c.url))) return false;
      const date = c.publishedAt ?? c.modifiedAt;
      if (
        date &&
        Number.isFinite(Date.parse(date)) &&
        Date.parse(date) < cutoff
      ) {
        outsideWindow++;
        return false;
      }
      if (
        c.discoveredVia.includes("sitemap") &&
        !/agent|context|harness|mcp|llm|copilot|claude|codex|coding|eval|memory|sandbox|tool|test|prompt|generative|ai-/i.test(
          new URL(c.url).pathname,
        ) &&
        source.id !== "cursor"
      )
        return false;
      // Full article indexes/sitemaps often lack excerpts. Fetch those originals rather than treating missing snippets as irrelevance.
      return (
        (!c.text && !c.title) ||
        isCandidate(c) ||
        /sitemap|\/engineering$|\/blog$|\/\d{4}\/$/.test(c.discoveredVia)
      );
    });
    const limit = backfill ? (source.backfillLimit ?? 400) : 150,
      bounded = candidates.slice(0, limit);
    const collect = async (candidate: Candidate) => {
      const url = canonicalUrl(candidate.url);
      examined++;
      if (
        source.id === "simon" &&
        /^(Quoting |Introducing )|live blog|Notes on .*deal/i.test(
          candidate.title ?? "",
        )
      ) {
        review.push({
          sourceId: source.id,
          url,
          reason: "Secondary attribution requires review",
        });
        return;
      }
      try {
        const html = await fetchText(candidate.url, source);
        const article = extractArticle(
          html,
          candidate,
          source.articleSelector,
          source.publicationHeaderSelector,
        );
        if (
          Date.parse(article.publication.value) < cutoff ||
          article.publication.value > observedAt
        ) {
          outsideWindow++;
          return;
        }
        const topicIds = engineeringTopics(article.title, article.text, topics);
        if (!topicIds.length) {
          unmatched++;
          return;
        }
        if (known.has(url)) return;
        const duplicate = possibleDuplicate(
          {
            title: article.title,
            excerpt: article.excerpt,
            canonicalUrl: url,
            publishedAt: article.publication.value,
          },
          signals,
        );
        if (duplicate) {
          review.push({
            sourceId: source.id,
            url,
            reason: `Possible shared event/syndication with ${duplicate.canonicalUrl}; attribution review required`,
          });
          return;
        }
        const matched = topics
          .filter((t) => topicIds.includes(t.id))
          .map((t) => t.name)
          .join(", ");
        const publication = article.publication;
        signals.push({
          id: hash(url).slice(0, 20),
          sourceId: source.id,
          canonicalUrl: url,
          title: article.title,
          publishedAt: publication.value,
          observedAt,
          topicIds,
          type: "technical-explanation",
          summary:
            article.excerpt +
            (article.text.length > article.excerpt.length ? "…" : ""),
          excerpt: article.excerpt,
          verificationStatus: "verified",
          contentHash: hash(html),
          extractionVersion: EXTRACTION_VERSION,
          publicationDateEvidence: publication,
          evidenceNotes: `Original article retrieved from ${new URL(source.url).hostname}; navigation, related stories, and footer content excluded. Publication date: ${publication.basis} (${publication.raw}, ${publication.precision} precision). ${publication.corroboratingDate ? `Feed publication day differs; original date corroborated in the publication header (${publication.corroboratingDate}). ` : ""}Discovery: ${candidate.discoveredVia}. Literal topic phrases matched in article body: ${matched}. Excerpt is verbatim original text. No inference of production use.`,
        });
        known.add(url);
        added++;
        if (added % 20 === 0)
          console.log(`${source.id}: ${added} verified additions`);
      } catch (e) {
        const reason = String(e instanceof Error ? e.message : e);
        if (/^HTTP (401|403):/.test(reason)) accessRestricted = true;
        review.push({ sourceId: source.id, url, reason });
      } finally {
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    // Two concurrent originals per publisher; a failure never mutates the persisted public dataset.
    for (let i = 0; i < bounded.length && !accessRestricted; i += 2)
      await Promise.all(bounded.slice(i, i + 2).map(collect));
    const sourceSignals = signals.filter(
      (s) => s.sourceId === source.id && s.verificationStatus === "verified",
    );
    const dates = sourceSignals.map((s) => s.publishedAt).sort();
    const old = coverage.find((c) => c.sourceId === source.id);
    const basis = `${backfill ? "Historical backfill" : "Incremental collection"} via ${discovery.methods.join(", ")}. ${discovery.candidates.length} discovered URLs; ${examined} new originals examined, ${added} admitted. ${discovery.truncated || candidates.length > limit ? "A collection bound was reached. " : ""}${accessRestricted ? "An access-restricted original was encountered; remaining originals were not requested this run. " : ""}Archives and rejected/inaccessible pages remain incomplete; counts are verified lower bounds.`;
    if (old) {
      old.start = dates.length && dates[0] < old.start ? dates[0] : old.start;
      old.end = observedAt;
      old.status = "partial";
      old.basis = basis;
    } else if (dates.length)
      coverage.push({
        sourceId: source.id,
        start: dates[0],
        end: observedAt,
        status: "partial",
        basis,
      });
    const log = {
      source: source.id,
      mode: backfill ? "historical-backfill" : "incremental",
      methods: discovery.methods,
      discovered: discovery.candidates.length,
      examined,
      added,
      unmatched,
      outsideWindow,
      rejected: review.filter((r) => r.sourceId === source.id).length,
      accessRestricted,
      truncated:
        accessRestricted || discovery.truncated || candidates.length > limit,
    };
    logs.push(log);
    console.log(JSON.stringify(log));
  }
  const output = DatasetSchema.parse({
    version: 1,
    coverageVersion: "curated-archives-v3",
    updatedAt: observedAt,
    sources,
    topics,
    signals: deduplicate(signals),
    coverage,
  });
  if (!output.signals.length)
    throw new Error("No verified evidence; preserving public dataset");
  await mkdir("data", { recursive: true });
  review.sort((a, b) =>
    (a.sourceId + (a.url ?? "") + a.reason).localeCompare(
      b.sourceId + (b.url ?? "") + b.reason,
    ),
  );
  await writeFile("data/review.json", JSON.stringify(review, null, 2) + "\n");
  if (backfill) {
    let prior: Record<string, unknown>[] = [];
    try {
      prior =
        JSON.parse(await readFile("data/backfill-log.json", "utf8")).sources ??
        [];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const merged = new Map(prior.map((log) => [log.source, log]));
    for (const log of logs) merged.set(log.source, { ...log, observedAt });
    await writeFile(
      "data/backfill-log.json",
      JSON.stringify(
        {
          coverageVersion: "curated-archives-v3",
          sources: [...merged.values()].sort((a, b) =>
            String(a.source).localeCompare(String(b.source)),
          ),
        },
        null,
        2,
      ) + "\n",
    );
  }
  await writeFile(
    "data/collection-log.json",
    JSON.stringify(
      {
        observedAt,
        mode: backfill ? "historical-backfill" : "incremental",
        extractionVersion: EXTRACTION_VERSION,
        logs,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    "data/dataset.next.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  await rename("data/dataset.next.json", "data/dataset.json");
  console.log(
    JSON.stringify({
      verified: output.signals.length,
      review: review.length,
      coverageVersion: output.coverageVersion,
    }),
  );
}
if (process.argv[1]?.endsWith("collect.ts"))
  run().catch((e) => {
    console.error("Collection failed; last valid public dataset preserved.", e);
    process.exitCode = 1;
  });
