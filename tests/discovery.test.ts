import { describe, it, expect, vi, beforeEach } from "vitest";
import { discover } from "../packages/pipeline/src/discover";
import { fetchText } from "../packages/pipeline/src/fetch";
import type { Source } from "../packages/domain/src";
vi.mock("../packages/pipeline/src/fetch", () => ({ fetchText: vi.fn() }));
const source = (extras: Partial<Source> = {}): Source => ({
  id: "fixture",
  name: "Fixture",
  url: "https://example.com",
  type: "engineering-blog",
  independentGroup: "fixture",
  enabled: true,
  discoveredAt: "2026-10-27T00:00:00Z",
  feedUrl: "https://example.com/feed",
  ...extras,
});
const feed = (urls: string[]) =>
  "<rss><channel>" +
  urls
    .map(
      (url) =>
        `<item><title>Agent memory</title><link>${url}</link><pubDate>Tue, 20 Oct 2026 00:00:00 GMT</pubDate></item>`,
    )
    .join("") +
  "</channel></rss>";
beforeEach(() => {
  vi.mocked(fetchText).mockReset();
});
describe("bounded archive discovery", () => {
  it("stops when a publisher ignores feed pagination", async () => {
    vi.mocked(fetchText).mockResolvedValue(
      feed(["https://example.com/article"]),
    );
    const result = await discover(source({ feedPageLimit: 8 }), true, 0);
    expect(result.candidates).toHaveLength(1);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });
  it("deduplicates overlap across publisher channels", async () => {
    vi.mocked(fetchText).mockResolvedValue(
      feed(["https://example.com/article"]),
    );
    const result = await discover(
      source({ additionalFeedUrls: ["https://example.com/another-feed"] }),
      false,
      0,
    );
    expect(result.candidates).toHaveLength(1);
  });
  it("does not assign partner/community posts to Hugging Face independence", async () => {
    vi.mocked(fetchText).mockResolvedValue(
      feed([
        "https://example.com/blog/official-agent-article",
        "https://example.com/blog/microsoft/agent-article",
      ]),
    );
    const result = await discover(source({ id: "huggingface" }), false, 0);
    expect(result.candidates.map((c) => c.url)).toEqual([
      "https://example.com/blog/official-agent-article",
    ]);
  });
  it("follows only bounded publisher post shards and excludes translated duplicates", async () => {
    vi.mocked(fetchText).mockImplementation(async (url) => {
      return url.endsWith("sitemap.xml")
        ? "<sitemapindex><sitemap><loc>https://example.com/sitemap-posts-5.xml</loc></sitemap><sitemap><loc>https://example.com/sitemap-authors.xml</loc></sitemap></sitemapindex>"
        : "<urlset><url><loc>https://example.com/agent-tools</loc></url><url><loc>https://example.com/fr-fr/agent-tools</loc></url></urlset>";
    });
    const result = await discover(
      source({
        id: "cloudflare",
        feedUrl: undefined,
        sitemapUrl: "https://example.com/sitemap.xml",
      }),
      true,
      0,
    );
    expect(result.candidates.map((c) => c.url)).toEqual([
      "https://example.com/agent-tools",
    ]);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });
  it("does not run broad sitemap backfill on the regular incremental schedule", async () => {
    vi.mocked(fetchText).mockResolvedValue(
      feed(["https://example.com/article"]),
    );
    await discover(
      source({ sitemapUrl: "https://example.com/sitemap.xml" }),
      false,
      0,
    );
    expect(fetchText).toHaveBeenCalledTimes(1);
  });
});
