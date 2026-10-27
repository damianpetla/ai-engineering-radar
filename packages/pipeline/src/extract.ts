import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { canonicalUrl, matchTopics, type Topic } from "../../domain/src/index";

export type Candidate = {
  url: string;
  title?: string;
  publishedAt?: string;
  modifiedAt?: string;
  text?: string;
  discoveredVia: string;
};
export type PublicationDate = {
  value: string;
  basis: "article-metadata" | "visible-date" | "publisher-feed";
  precision: "day" | "second";
  raw: string;
  feedValue?: string;
  corroboratingDate?: string;
};
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: true,
});
const array = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
export const plain = (html: string) => {
  const $ = load(html);
  $("script,style,noscript").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
};
export function parseFeed(body: string): Candidate[] {
  const parsed = xml.parse(body);
  const entries = parsed.feed?.entry ?? parsed.rss?.channel?.item;
  if (!entries) throw new Error("Not an RSS/Atom feed");
  return array<Record<string, any>>(entries).map((e) => ({
    title: plain(String(e.title?.["#text"] ?? e.title ?? "")),
    url:
      typeof e.link === "string"
        ? e.link
        : (array<Record<string, string>>(e.link).find(
            (l) => !l["@_rel"] || l["@_rel"] === "alternate",
          )?.["@_href"] ?? ""),
    publishedAt: e.published ?? e.pubDate,
    modifiedAt: e.updated,
    text: plain(
      String(
        e["content:encoded"] ??
          e.content?.["#text"] ??
          e.content ??
          e.description ??
          e.summary?.["#text"] ??
          e.summary ??
          "",
      ),
    ),
    discoveredVia: "publisher-feed",
  }));
}
export function sitemapUrls(
  body: string,
): { url: string; modifiedAt?: string }[] {
  const parsed = xml.parse(body);
  if (!parsed.urlset)
    throw new Error("Expected a publication sitemap, not an index");
  return array<Record<string, string>>(parsed.urlset.url).map((e) => ({
    url: e.loc,
    modifiedAt: e.lastmod,
  }));
}
function normalizeDate(
  raw: string,
): { value: string; precision: "day" | "second" } | null {
  if (/^\d{4}-\d{2}-\d{2}(?:T\d\d:\d\d(?::\d\d(?:\.\d+)?)?)?$/.test(raw)) {
    const day = raw.slice(0, 10),
      value = new Date(day + "T00:00:00.000Z");
    return Number.isFinite(+value) && value.toISOString().startsWith(day)
      ? { value: value.toISOString(), precision: "day" }
      : null;
  }
  if (!/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(raw.trim())) return null;
  const value = new Date(raw);
  return Number.isFinite(+value)
    ? { value: value.toISOString(), precision: "second" }
    : null;
}
export function extractArticle(
  html: string,
  candidate: Candidate,
  selector?: string,
  publicationHeaderSelector?: string,
) {
  const $ = load(html);
  const canonical = $("link[rel='canonical']").attr("href");
  if (
    canonical &&
    canonicalUrl(new URL(canonical, candidate.url).href) !==
      canonicalUrl(candidate.url)
  )
    throw new Error(
      "Canonical URL differs; attribution/duplicate review required",
    );
  const jsonRecords: Record<string, any>[] = [];
  const visit = (value: any) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (
        /Article|BlogPosting|SocialMediaPosting|TechArticle/.test(
          String(value["@type"]),
        )
      )
        jsonRecords.push(value);
      if (value["@graph"]) visit(value["@graph"]);
    }
  };
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      visit(JSON.parse($(el).text()));
    } catch {
      /* Malformed JSON-LD is not publication evidence. */
    }
  });
  const metadata =
    jsonRecords.find((r) => {
      const raw = r.url ?? r["@id"];
      return (
        !raw ||
        (() => {
          try {
            return (
              canonicalUrl(new URL(raw, candidate.url).href) ===
              canonicalUrl(candidate.url)
            );
          } catch {
            return false;
          }
        })()
      );
    }) ?? (jsonRecords.length === 1 ? jsonRecords[0] : undefined);
  const title = plain(
    String(
      (selector === ".entry.entryPage"
        ? $(selector).find("h2").first().text()
        : $("h1").first().text()) ||
        metadata?.headline ||
        candidate.title ||
        "",
    ),
  );
  const metaDates = [
    ...$(
      "meta[property='article:published_time'],meta[name='datePublished'],meta[itemprop='datePublished']",
    )
      .map((_, el) => $(el).attr("content") ?? "")
      .get(),
    ...(metadata?.datePublished ? [String(metadata.datePublished)] : []),
  ];
  const parsedDates = metaDates
    .map((raw) => ({ raw, date: normalizeDate(raw) }))
    .filter(
      (
        v,
      ): v is {
        raw: string;
        date: NonNullable<ReturnType<typeof normalizeDate>>;
      } => v.date !== null,
    );
  if (new Set(parsedDates.map((d) => d.date.value.slice(0, 10))).size > 1)
    throw new Error("Conflicting original publication dates");
  let publication: PublicationDate | undefined;
  if (parsedDates.length)
    publication = {
      ...parsedDates[0].date,
      raw: parsedDates[0].raw,
      basis: "article-metadata",
    };
  if (!publication) {
    // The first date in the primary header/main is considered only on pages with a single article heading.
    const primaryTime =
      $("main").first().find("time[datetime]").first().attr("datetime") ??
      $("time[datetime]").first().attr("datetime");
    if (primaryTime && $("h1").length === 1) {
      const d = normalizeDate(primaryTime);
      if (d) publication = { ...d, raw: primaryTime, basis: "visible-date" };
    }
  }
  const feed = candidate.publishedAt
    ? normalizeDate(candidate.publishedAt)
    : null;
  if (
    publication &&
    feed &&
    publication.value.slice(0, 10) !== feed.value.slice(0, 10)
  ) {
    const visibleDate = new Date(publication.value).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
    );
    const header = publicationHeaderSelector
      ? $(publicationHeaderSelector).first().text().replace(/\s+/g, " ").trim()
      : "";
    if (header.includes(visibleDate))
      publication.corroboratingDate = visibleDate;
    else
      throw new Error(
        "Publisher feed and original page disagree on publication day",
      );
  }
  if (!publication && feed)
    publication = {
      ...feed,
      raw: candidate.publishedAt!,
      basis: "publisher-feed",
    };
  if (!publication)
    throw new Error(
      "No grounded publication date (modification dates excluded)",
    );
  if (candidate.publishedAt) publication.feedValue = candidate.publishedAt;
  const selectors = selector
    ? [selector]
    : [
        ".blog-content",
        ".blog-post-content",
        ".entry-content",
        '[itemprop="articleBody"]',
        "article",
      ];
  let article = selectors
    .map((s) => $(s).first())
    .find((el) => el.length && el.text().trim().length >= 100);
  if (!article) throw new Error("No isolated article body");
  article = article.clone();
  article
    .find(
      'script,style,nav,aside,footer,form,dialog,[class*="related"],[class*="newsletter"],[class*="table-of-contents"],.toc,.entryFooter',
    )
    .remove();
  const paragraphs = article
    .find("p,li,h2,h3,pre")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const text = (paragraphs.length ? paragraphs.join(" ") : article.text())
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = (paragraphs.find((p) => p.length >= 80) ?? text)
    .slice(0, 300)
    .trim();
  if (title.length < 5 || text.length < 120 || excerpt.length < 60)
    throw new Error("Insufficient original article text");
  return { title, text, excerpt, publication };
}
export function engineeringTopics(
  title: string,
  text: string,
  topics: Topic[],
) {
  if (
    !/\b(agent\w*|llms?|ai|artificial intelligence|copilot|claude|codex|mcp)\b/i.test(
      title + " " + text,
    )
  )
    return [];
  return matchTopics(title + " " + text, topics);
}
export const isCandidate = (c: Candidate) =>
  /agent|context|harness|MCP|LLM|copilot|claude|codex|coding|eval|memory|sandbox|tool|artificial intelligence|AI[- ]/i.test(
    (c.title ?? "") + " " + (c.text ?? ""),
  );
