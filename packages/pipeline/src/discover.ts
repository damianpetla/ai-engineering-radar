import { load } from "cheerio";
import { canonicalUrl, type Source } from "../../domain/src/index";
import { fetchText } from "./fetch";
import { parseFeed, sitemapUrls, type Candidate } from "./extract";
export async function discover(
  source: Source,
  backfill: boolean,
  cutoff: number,
): Promise<{ candidates: Candidate[]; methods: string[]; truncated: boolean }> {
  const candidates: Candidate[] = [],
    methods: string[] = [];
  let truncated = false;
  for (const feed of [
    source.feedUrl,
    ...(source.additionalFeedUrls ?? []),
  ].filter((v): v is string => !!v)) {
    methods.push("publisher-feed");
    const pages = backfill ? (source.feedPageLimit ?? 1) : 1;
    let previousSignature = "";
    for (let page = 1; page <= pages; page++) {
      const url = new URL(feed);
      if (page > 1) url.searchParams.set("paged", String(page));
      const items = parseFeed(await fetchText(url.href, source));
      const signature = items.map((i) => i.url).join("\n");
      if (signature === previousSignature) break;
      previousSignature = signature;
      candidates.push(...items.map((c) => ({ ...c, discoveredVia: url.href })));
      if (
        items.length &&
        items.every((i) => i.publishedAt && Date.parse(i.publishedAt) < cutoff)
      )
        break;
      if (page === pages && pages > 1) truncated = true;
    }
  }
  if (source.discoveryUrl) {
    methods.push("publisher-index");
    const index = await fetchText(source.discoveryUrl, source),
      $ = load(index);
    const pattern = source.discoveryLinkPattern
      ? new RegExp(source.discoveryLinkPattern)
      : /^\/(?:research|engineering)\/[^/]+\/?$/;
    const links = $("a[href]")
      .map((_, el) => ({
        href: $(el).attr("href")!,
        title: $(el).text().trim(),
      }))
      .get();
    for (const link of links) {
      const u = new URL(link.href, source.discoveryUrl);
      if (
        u.hostname === new URL(source.url).hostname &&
        pattern.test(u.pathname)
      )
        candidates.push({
          url: u.href,
          title: link.title,
          discoveredVia: source.discoveryUrl,
        });
    }
  }
  if (backfill && source.sitemapUrl) {
    methods.push("publisher-sitemap");
    const body = await fetchText(source.sitemapUrl, source);
    let urls: { url: string; modifiedAt?: string }[];
    if (body.includes("<sitemapindex")) {
      const $ = load(body, { xml: true });
      const shards = $("sitemap > loc")
        .map((_, el) => $(el).text())
        .get()
        .filter(
          (u) =>
            new URL(u).hostname === new URL(source.url).hostname &&
            /sitemap-posts(?:-\d+)?\.xml$/.test(new URL(u).pathname),
        )
        .slice(0, 8);
      urls = [];
      for (const shard of shards)
        urls.push(...sitemapUrls(await fetchText(shard, source)));
    } else urls = sitemapUrls(body);
    urls = urls.filter(
      (c) =>
        new URL(c.url).pathname.startsWith(source.sitemapPathPrefix ?? "/") &&
        (source.id !== "cloudflare" ||
          /^\/[a-z0-9-]+\/?$/.test(new URL(c.url).pathname)),
    );
    // Modification times only prioritize discovery. They never establish a publication timestamp.
    const relevant = urls
      .filter(
        (c) =>
          source.id === "cursor" ||
          /agent|context|harness|mcp|llm|copilot|claude|codex|coding|eval|memory|sandbox|tool|test|prompt|generative|ai-/i.test(
            new URL(c.url).pathname,
          ),
      )
      .sort((a, b) => (b.modifiedAt ?? "").localeCompare(a.modifiedAt ?? ""));
    const limit = source.backfillLimit ?? 300;
    truncated ||= relevant.length > limit;
    candidates.push(
      ...relevant
        .slice(0, limit)
        .map((c) => ({ ...c, discoveredVia: source.sitemapUrl! })),
    );
  }
  if (backfill && source.id === "armin") {
    methods.push("publisher-year-archive");
    const year = new Date().getUTCFullYear();
    for (const y of new Set([year, new Date(cutoff).getUTCFullYear()])) {
      const url = new URL(`/${y}/`, source.url).href,
        $ = load(await fetchText(url, source));
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href")!;
        if (/^\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/$/.test(href))
          candidates.push({
            url: new URL(href, source.url).href,
            title: $(el).text(),
            discoveredVia: url,
          });
      });
    }
  }
  if (source.archiveBase) {
    methods.push("publisher-monthly-authored-archive");
    const current = new Date(),
      months = [
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
    for (let offset = 0; offset < (backfill ? 7 : 2); offset++) {
      const month = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1),
      );
      if (+month + 32 * 86400000 < cutoff) break;
      const url = new URL(
        `${month.getUTCFullYear()}/${months[month.getUTCMonth()]}/`,
        source.archiveBase,
      ).href;
      let html = await fetchText(url, source),
        $ = load(html);
      const pages = Math.min(
        backfill ? 8 : 2,
        Math.max(
          1,
          ...$("a[href]")
            .map((_, el) =>
              Number(
                ($(el).attr("href") ?? "").match(/^\?page=(\d+)$/)?.[1] ?? 1,
              ),
            )
            .get(),
        ),
      );
      for (let page = 2; page <= pages; page++)
        html += "\n" + (await fetchText(`${url}?page=${page}`, source));
      $ = load(html);
      $('.entry.segment[data-type="entry"]').each((_, el) => {
        const a = $(el).find('h3 a[rel="bookmark"]').first();
        if (a.attr("href"))
          candidates.push({
            url: new URL(a.attr("href")!, source.url).href,
            title: a.text(),
            text: $(el).text(),
            discoveredVia: url,
          });
      });
      truncated ||= pages === 8;
    }
  }
  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) {
    try {
      const u = new URL(candidate.url);
      if (
        u.protocol !== "https:" ||
        u.hostname !== new URL(source.url).hostname
      )
        continue;
      if (
        (source.id === "huggingface" || source.id === "cursor") &&
        !/^\/blog\/[^/]+\/?$/.test(u.pathname)
      )
        continue; // Community/partner namespaces need their own approved publisher identity.
      if (source.id === "vercel" && !u.pathname.startsWith("/blog/")) continue;
      if (source.id === "cloudflare" && !/^\/[a-z0-9-]+\/?$/.test(u.pathname))
        continue; // Keep technical publications, not a flood of product changelog events.
      if (/\/(?:authors?|tags?|category|team)\//.test(u.pathname)) continue;
      const key = canonicalUrl(candidate.url),
        previous = unique.get(key);
      if (!previous) unique.set(key, candidate);
      else if (!previous.publishedAt && candidate.publishedAt)
        unique.set(key, { ...previous, ...candidate });
    } catch {
      /* Invalid discovered links are never fetched. */
    }
  }
  return {
    candidates: [...unique.values()],
    methods: [...new Set(methods)],
    truncated,
  };
}
