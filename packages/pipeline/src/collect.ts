import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import {
  DatasetSchema,
  SourceSchema,
  TopicSchema,
  canonicalUrl,
  matchTopics,
  deduplicate,
  type Dataset,
  type Source,
  type Topic,
  type Signal,
} from "../../domain/src/index";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: true,
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function plain(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&(?:nbsp|amp|lt|gt|quot|apos|#39|#x27);/g,
      (s) =>
        ({
          "&nbsp;": " ",
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&#39;": "'",
          "&#x27;": "'",
        })[s] ?? s,
    )
    .replace(/\s+/g, " ")
    .trim();
}
const list = (x: any) => (!x ? [] : Array.isArray(x) ? x : [x]);
export function parseFeed(xml: string) {
  const parsed = parser.parse(xml);
  const entries = parsed.feed?.entry ?? parsed.rss?.channel?.item;
  if (!entries) throw Error("Not an RSS/Atom feed");
  return list(entries).map((e: any) => ({
    title: plain(String(e.title?.["#text"] ?? e.title ?? "")),
    url:
      typeof e.link === "string"
        ? e.link
        : list(e.link).find(
            (l: any) => !l["@_rel"] || l["@_rel"] === "alternate",
          )?.["@_href"],
    date: e.published ?? e.pubDate ?? e.updated,
    text: plain(
      String(
        e.content?.["#text"] ??
          e.content ??
          e.description ??
          e.summary?.["#text"] ??
          e.summary ??
          "",
      ),
    ),
  }));
}
class PermanentSourceError extends Error {}
async function fetchText(url: string, source: Source) {
  const target = new URL(url);
  if (target.hostname !== new URL(source.url).hostname)
    throw Error(`Unapproved host ${target.hostname}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "AIEngineeringRadar/1.0 (public engineering observatory; bounded collection)",
        },
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (res.status >= 400 && res.status < 500 && res.status !== 429)
        throw new PermanentSourceError(`HTTP ${res.status}: ${url}`);
      if (!res.ok) throw Error(`HTTP ${res.status}: ${url}`);
      const length = Number(res.headers.get("content-length") ?? 0);
      if (length > 3_000_000) throw Error("Response too large");
      const body = await res.text();
      if (body.length > 3_000_000) throw Error("Response too large");
      return body;
    } catch (e) {
      if (attempt === 2 || e instanceof PermanentSourceError) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw Error("Fetch failed");
}
async function run() {
  const sources = SourceSchema.array().parse(JSON.parse(await readFile("data/sources.json", "utf8")));
  const topics = TopicSchema.array().parse(JSON.parse(await readFile("data/topics.json", "utf8")));
  let previous: Dataset | undefined;
  try {
    previous = DatasetSchema.parse(
      JSON.parse(await readFile("data/dataset.json", "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const observedAt = new Date().toISOString(),
    cutoff = Date.parse(observedAt) - 180 * 86400000;
  const signals: Signal[] = [...(previous?.signals ?? [])];
  const review: any[] = [];
  const coverage = [...(previous?.coverage ?? [])];
  const logs: any[] = [];
  for (const source of sources.filter((s) => s.enabled && s.feedUrl)) {
    const xml = await fetchText(source.feedUrl!, source);
    const entries = parseFeed(xml);
    let added = 0;
    let oldest = observedAt;
    for (const item of entries.slice(0, 1500)) {
      if (!item.url || !item.date || !Number.isFinite(Date.parse(item.date))) {
        review.push({
          sourceId: source.id,
          title: item.title,
          reason: "Missing grounded URL/date",
        });
        continue;
      }
      const publishedAt = new Date(item.date).toISOString();
      if (Date.parse(publishedAt) < cutoff || publishedAt > observedAt)
        continue;
      if (publishedAt < oldest) oldest = publishedAt;
      const topicIds = matchTopics(item.title + " " + item.text, topics);
      if (!topicIds.length) continue;
      let url: string;
      try {
        url = canonicalUrl(item.url);
        if (new URL(url).hostname !== new URL(source.url).hostname)
          throw Error("External attribution");
      } catch {
        review.push({
          sourceId: source.id,
          title: item.title,
          reason: "External attribution",
        });
        continue;
      }
      if (signals.some((s) => s.canonicalUrl === url)) continue;
      // Linkblog entries and quotations describe someone else's event; route to review.
      if (
        source.id === "simon" &&
        (/^(Quoting |Introducing )/.test(item.title) ||
          item.text.startsWith(item.title))
      ) {
        review.push({ url, reason: "Possible secondary attribution" });
        continue;
      }
      if (!item.text || item.text.length < 80) {
        review.push({ url, reason: "Insufficient primary text" });
        continue;
      }
      let html: string;
      try {
        html = await fetchText(item.url, source);
      } catch (e) {
        review.push({
          url,
          reason: "Primary page unavailable; excluded from public metrics",
          error: String(e),
        });
        continue;
      }
      const body = plain(html);
      const excerpt = item.text.slice(0, 400).trim();
      if (!body.includes(excerpt.slice(0, 100))) {
        review.push({ url, reason: "Feed excerpt not found on primary page" });
        continue;
      }
      signals.push({
        id: hash(url).slice(0, 20),
        sourceId: source.id,
        canonicalUrl: url,
        title: item.title,
        publishedAt,
        observedAt,
        topicIds,
        type: "technical-explanation",
        summary: excerpt + (item.text.length > 400 ? "…" : ""),
        excerpt,
        verificationStatus: "verified",
        evidenceNotes:
          "Publisher feed supplies the publication date. Feed excerpt matched against the retrieved original page. Topic mapping uses versioned literal phrases. Classification describes a publication, not production use.",
        contentHash: hash(html),
      });
      added++;
      await new Promise((r) => setTimeout(r, 180));
    }
    const old = coverage.find((c) => c.sourceId === source.id);
    if (old) {
      old.start = old.start < oldest ? old.start : oldest;
      old.end = observedAt;
      old.status = "partial";
    } else
      coverage.push({
        sourceId: source.id,
        start: oldest,
        end: observedAt,
        status: "partial",
        basis:
          "Bounded publisher feed archive; retrieval verified, historical completeness not established.",
      });
    logs.push({ source: source.id, entries: entries.length, added });
  }
  for (const source of sources.filter((s) => s.enabled && s.discoveryUrl)) {
    const index = await fetchText(source.discoveryUrl!, source);
    const urls = [
      ...new Set(
        [
          ...index.matchAll(/href="(\/(?:research|engineering)\/[^"?#]+)"/g),
        ].map((m) => new URL(m[1], source.url).href),
      ),
    ]
      .filter((u) => !u.includes("/team/"))
      .slice(0, 60);
    let added = 0,
      oldest = observedAt;
    for (const pageUrl of urls) {
      const url = canonicalUrl(pageUrl);
      if (signals.some((s) => s.canonicalUrl === url)) continue;
      let html: string;
      try {
        html = await fetchText(pageUrl, source);
      } catch (e) {
        review.push({
          url,
          reason: "Archive page unavailable",
          error: String(e),
        });
        continue;
      }
      const rawDate = html.match(
        /property="article:published_time" content="([^"]+)"/,
      )?.[1];
      if (!rawDate || !Number.isFinite(Date.parse(rawDate))) {
        review.push({ url, reason: "Missing publication metadata" });
        continue;
      }
      const publishedAt = new Date(rawDate).toISOString();
      if (Date.parse(publishedAt) < cutoff || publishedAt > observedAt)
        continue;
      if (publishedAt < oldest) oldest = publishedAt;
      const title = plain(
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ??
          html.match(/<title>(.*?)<\/title>/)?.[1] ??
          "",
      );
      const article =
        html.match(/<article[^>]*>([\s\S]*?)<\/article>/)?.[1] ??
        html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ??
        "";
      const text = plain(article);
      const topicIds = matchTopics(title + " " + text, topics);
      if (!topicIds.length) continue;
      const description = html.match(
        /<meta name="description" content="([^"]+)"/,
      )?.[1];
      const excerpt = plain(description ?? text.slice(0, 400));
      if (!title || excerpt.length < 60) {
        review.push({ url, reason: "Insufficient publication text" });
        continue;
      }
      signals.push({
        id: hash(url).slice(0, 20),
        sourceId: source.id,
        canonicalUrl: url,
        title,
        publishedAt,
        observedAt,
        topicIds,
        type: "technical-explanation",
        summary: excerpt,
        excerpt,
        verificationStatus: "verified",
        contentHash: hash(html),
        evidenceNotes:
          "Discovered on the publisher engineering index. Publication date comes from article:published_time metadata; excerpt comes verbatim from the original page description. Topic phrases matched in the article. No inference of production use.",
      });
      added++;
      await new Promise((r) => setTimeout(r, 180));
    }
    const old = coverage.find((c) => c.sourceId === source.id);
    if (old) {
      old.start = old.start < oldest ? old.start : oldest;
      old.end = observedAt;
    } else if (oldest < observedAt)
      coverage.push({
        sourceId: source.id,
        start: oldest,
        end: observedAt,
        status: "partial",
        basis:
          "Bounded discovery from the publisher engineering index; historical completeness not established.",
      });
    logs.push({ source: source.id, entries: urls.length, added });
  }
  for (const source of sources.filter((s) => s.enabled && s.archiveBase)) {
    let added = 0,
      entries = 0,
      oldest = observedAt;
    const current = new Date(observedAt);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    for (let offset = 0; offset < 6; offset++) {
      const month = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1),
      );
      const archiveUrl = new URL(
        `${month.getUTCFullYear()}/${months[month.getUTCMonth()]}/`,
        source.archiveBase,
      ).href;
      let index = await fetchText(archiveUrl, source);
      const lastPage = Math.min(
        8,
        Math.max(
          1,
          ...[...index.matchAll(/href="\?page=(\d+)"/g)].map((m) =>
            Number(m[1]),
          ),
        ),
      );
      for (let page = 2; page <= lastPage; page++)
        index += "\n" + (await fetchText(`${archiveUrl}?page=${page}`, source));
      const blocks = [
        ...index.matchAll(
          /<div class="entry segment"[^>]*>([\s\S]*?)<!-- end div.entry -->/g,
        ),
      ].slice(0, 240);
      entries += blocks.length;
      for (const block of blocks) {
        const relative = block[1].match(/<h3><a href="([^"]+)"/)?.[1];
        if (!relative) continue;
        const pageUrl = new URL(relative, source.url).href,
          url = canonicalUrl(pageUrl);
        if (signals.some((s) => s.canonicalUrl === url)) continue;
        // Avoid fetching unrelated publications and secondary event liveblogs.
        if (!matchTopics(plain(block[1]), topics).length) continue;
        const parts = new URL(url).pathname.match(
          /^\/(\d{4})\/([A-Z][a-z]{2})\/(\d{1,2})\//,
        );
        if (!parts) continue;
        const publishedAt = new Date(
          Date.UTC(
            Number(parts[1]),
            months.indexOf(parts[2]),
            Number(parts[3]),
          ),
        ).toISOString();
        if (Date.parse(publishedAt) < cutoff || publishedAt > observedAt)
          continue;
        let html: string;
        try {
          html = await fetchText(pageUrl, source);
        } catch (e) {
          review.push({
            url,
            reason: "Authored archive page unavailable",
            error: String(e),
          });
          continue;
        }
        const article = html.match(
          /<div class="entry entryPage">([\s\S]*?)<div class="entryFooter">/,
        )?.[1];
        if (!article) {
          review.push({ url, reason: "Not a primary authored article" });
          continue;
        }
        const title = plain(
          article.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "",
        );
        if (/(live blog|Notes on .*deal)/i.test(title)) {
          review.push({
            url,
            reason: "Secondary event attribution requires review",
          });
          continue;
        }
        const visibleDate = plain(
          article.match(/<p class="mobile-date">([^<]+)<\/p>/)?.[1] ?? "",
        );
        const expectedMonth = new Date(publishedAt).toLocaleDateString(
          "en-GB",
          { month: "long", timeZone: "UTC" },
        );
        if (
          !visibleDate.includes(expectedMonth) ||
          !visibleDate.includes(parts[1]) ||
          parseInt(visibleDate) !== Number(parts[3])
        ) {
          review.push({
            url,
            reason: "Archive URL date does not match visible publication date",
          });
          continue;
        }
        const text = plain(article),
          topicIds = matchTopics(title + " " + text, topics);
        if (!topicIds.length) continue;
        const paragraphs = [...article.matchAll(/<p>([\s\S]*?)<\/p>/g)]
          .map((m) => plain(m[1]))
          .filter((t) => t.length > 30)
          .join(" ");
        const excerpt = paragraphs.slice(0, 400).trim();
        if (excerpt.length < 80) continue;
        signals.push({
          id: hash(url).slice(0, 20),
          sourceId: source.id,
          canonicalUrl: url,
          title,
          publishedAt,
          observedAt,
          topicIds,
          type: "technical-explanation",
          summary: excerpt + (paragraphs.length > 400 ? "…" : ""),
          excerpt,
          verificationStatus: "verified",
          contentHash: hash(html),
          evidenceNotes:
            "Discovered in the publisher monthly archive as an authored entry, excluding linkblog items. Visible publication date agrees with the dated canonical URL. Date-only publication precision is represented as UTC midnight. Excerpt is verbatim article text. No inference of production use.",
        });
        added++;
        if (publishedAt < oldest) oldest = publishedAt;
        await new Promise((r) => setTimeout(r, 180));
      }
    }
    const old = coverage.find((c) => c.sourceId === source.id);
    if (old) {
      old.start = old.start < oldest ? old.start : oldest;
      old.end = observedAt;
      old.basis =
        "Publisher feed and six bounded monthly authored-entry archives; collection completeness not established.";
    }
    logs.push({ source: source.id + "-authored-archive", entries, added });
  }
  const output = DatasetSchema.parse({
    version: 1,
    coverageVersion: "curated-feeds-v2",
    updatedAt: observedAt,
    sources,
    topics,
    signals: deduplicate(signals),
    coverage,
  });
  if (!output.signals.length)
    throw Error("No verified evidence; preserving public dataset");
  await mkdir("data", { recursive: true });
  await writeFile("data/review.json", JSON.stringify(review, null, 2) + "\n");
  await writeFile(
    "data/collection-log.json",
    JSON.stringify({ observedAt, logs }, null, 2) + "\n",
  );
  await writeFile(
    "data/dataset.next.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  await rename("data/dataset.next.json", "data/dataset.json");
  console.log(
    JSON.stringify(
      { verified: output.signals.length, review: review.length, logs },
      null,
      2,
    ),
  );
}
if (process.argv[1]?.endsWith("collect.ts"))
  run().catch((e) => {
    console.error("Collection failed; last valid public dataset preserved.", e);
    process.exitCode = 1;
  });
