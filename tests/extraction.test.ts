import { describe, it, expect } from "vitest";
import {
  extractArticle,
  parseFeed,
  engineeringTopics,
  sitemapUrls,
} from "../packages/pipeline/src/extract";
import type { Topic } from "../packages/domain/src";
const excerpt =
  "This original technical publication describes how coding agents call tools and how to evaluate their behavior in controlled software workflows.";
const article = (metadata: string, body = excerpt) =>
  `<html><head>${metadata}</head><body><h1>Evaluating coding agents</h1><nav>agent memory</nav><article><p>${body}</p><aside>persistent memory</aside><div class="related-stories">agent memory</div></article></body></html>`;
const candidate = {
  url: "https://example.com/article",
  discoveredVia: "publisher-feed",
};
const topics: Topic[] = [
  {
    id: "memory",
    slug: "agent-memory",
    name: "Agent memory",
    description: "Fixture",
    category: "Fixture",
    aliases: ["persistent memory"],
    createdAt: "2026-01-01T00:00:00Z",
    status: "active",
  },
];
describe("primary article extraction", () => {
  it("reads publication metadata independent of attribute order and excludes navigation/related stories", () => {
    const a = extractArticle(
      article(
        '<meta content="2026-08-12T12:00:00Z" property="article:published_time">',
      ),
      candidate,
    );
    expect(a.publication.value).toBe("2026-08-12T12:00:00.000Z");
    expect(a.excerpt).toBe(excerpt);
    expect(engineeringTopics(a.title, a.text, topics)).toEqual([]);
  });
  it("uses JSON-LD original publication time rather than modification time", () => {
    const a = extractArticle(
      article(
        '<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"2026-05-15T12:00:00Z","dateModified":"2026-10-20T00:00:00Z"}</script>',
      ),
      candidate,
    );
    expect(a.publication.value).toBe("2026-05-15T12:00:00.000Z");
  });
  it("does not substitute Atom updated for a publication date", () => {
    const [c] = parseFeed(
      '<feed><entry><title>Agent memory</title><link href="https://example.com/article"/><updated>2026-10-20T00:00:00Z</updated></entry></feed>',
    );
    expect(c.publishedAt).toBeUndefined();
    expect(c.modifiedAt).toBeDefined();
    expect(() => extractArticle(article(""), c)).toThrow(
      "No grounded publication date",
    );
  });
  it("rejects conflicting publication days and mismatched canonical attribution", () => {
    expect(() =>
      extractArticle(
        article(
          '<meta property="article:published_time" content="2026-09-01T00:00:00Z">',
        ),
        { ...candidate, publishedAt: "Tue, 20 Oct 2026 00:00:00 GMT" },
      ),
    ).toThrow("disagree");
    expect(() =>
      extractArticle(
        article(
          '<link rel="canonical" href="https://example.com/another-article">',
        ),
        candidate,
      ),
    ).toThrow("Canonical");
  });
  it("keeps date-only precision explicit instead of inventing publication times", () => {
    const a = extractArticle(
      article(
        '<script type="application/ld+json">{"@type":"Article","datePublished":"2026-06-02"}</script>',
      ),
      candidate,
    );
    expect(a.publication).toMatchObject({
      value: "2026-06-02T00:00:00.000Z",
      precision: "day",
      raw: "2026-06-02",
    });
  });
  it("uses full WordPress article content for discovery and decodes typographic entities", () => {
    const [c] = parseFeed(
      "<rss><channel><item><title>Agent&#8217;s memory</title><link>https://example.com/article</link><description>Short snippet</description><content:encoded><![CDATA[<p>Original full content about agent memory.</p>]]></content:encoded></item></channel></rss>",
    );
    expect(c.title).toBe("Agent’s memory");
    expect(c.text).toContain("Original full content");
  });
  it("retains sitemap lastmod only as discovery metadata", () => {
    expect(
      sitemapUrls(
        "<urlset><url><loc>https://example.com/article</loc><lastmod>2026-10-20</lastmod></url></urlset>",
      ),
    ).toEqual([
      { url: "https://example.com/article", modifiedAt: "2026-10-20" },
    ]);
  });
  it("requires AI/agent context rather than counting generic software-memory articles", () =>
    expect(
      engineeringTopics(
        "Persistent memory",
        "persistent memory is a hardware property",
        topics,
      ),
    ).toEqual([]));
});
it("resolves a republished feed date only when original metadata agrees with the isolated visible publication header", () => {
  const html = article(
    '<script type="application/ld+json">{"@type":"Article","datePublished":"2026-05-05T13:03:00Z"}</script>',
  ).replace(
    "<article>",
    '<section class="publication-header">Published May 5, 2026</section><article>',
  );
  const a = extractArticle(
    html,
    { ...candidate, publishedAt: "Wed, 26 Aug 2026 15:02:51 GMT" },
    undefined,
    ".publication-header",
  );
  expect(a.publication).toMatchObject({
    value: "2026-05-05T13:03:00.000Z",
    feedValue: "Wed, 26 Aug 2026 15:02:51 GMT",
    corroboratingDate: "May 5, 2026",
  });
  expect(() =>
    extractArticle(
      html,
      { ...candidate, publishedAt: "Wed, 26 Aug 2026 15:02:51 GMT" },
      undefined,
      ".nonexistent",
    ),
  ).toThrow("disagree");
});
