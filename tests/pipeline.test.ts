import { it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { DatasetSchema } from "../packages/domain/src";
it("collection is idempotent and a failed feed cannot replace the last valid dataset", () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-test-"));
  try {
    mkdirSync(join(dir, "data"));
    const timestamp = new Date().toISOString();
    writeFileSync(
      join(dir, "data/sources.json"),
      JSON.stringify([
        {
          id: "fixture",
          name: "Test-only publisher",
          url: "https://example.com",
          feedUrl: "https://example.com/feed.xml",
          type: "engineering-blog",
          independentGroup: "fixture",
          enabled: true,
          discoveredAt: timestamp,
        },
      ]),
    );
    writeFileSync(
      join(dir, "data/topics.json"),
      JSON.stringify([
        {
          id: "mcp",
          slug: "mcp-tools",
          name: "MCP tools",
          description: "Test-only topic",
          category: "fixture",
          aliases: ["MCP"],
          createdAt: timestamp,
          status: "active",
        },
      ]),
    );
    const mock = join(dir, "mock.mjs");
    writeFileSync(
      mock,
      `globalThis.fetch=async(url)=>{if(process.env.RADAR_TEST_FAIL)throw new Error('Synthetic feed failure');const excerpt='MCP tools are the subject of this synthetic test-only publication. This is a deterministic fixture for pipeline integrity testing, never a production observation.';return new Response(String(url).endsWith('feed.xml')?'<rss><channel><item><title>Fixture MCP tools</title><link>https://example.com/article</link><pubDate>'+new Date(Date.now()-86400000).toUTCString()+'</pubDate><description>'+excerpt+'</description></item></channel></rss>':'<html><p>'+excerpt+'</p></html>',{status:200});};`,
    );
    const args = [
      "--import",
      createRequire(import.meta.url).resolve("tsx"),
      "--import",
      mock,
      resolve("packages/pipeline/src/collect.ts"),
    ];
    const run = () =>
      execFileSync(process.execPath, args, {
        cwd: dir,
        stdio: "pipe",
        timeout: 15000,
      });
    run();
    const first = DatasetSchema.parse(
      JSON.parse(readFileSync(join(dir, "data/dataset.json"), "utf8")),
    );
    run();
    const second = DatasetSchema.parse(
      JSON.parse(readFileSync(join(dir, "data/dataset.json"), "utf8")),
    );
    expect(first.signals).toHaveLength(1);
    expect(second.signals).toEqual(first.signals);
    const before = readFileSync(join(dir, "data/dataset.json"), "utf8");
    expect(() =>
      execFileSync(process.execPath, args, {
        cwd: dir,
        stdio: "pipe",
        timeout: 15000,
        env: { ...process.env, RADAR_TEST_FAIL: "1" },
      }),
    ).toThrow();
    expect(readFileSync(join(dir, "data/dataset.json"), "utf8")).toBe(before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);
