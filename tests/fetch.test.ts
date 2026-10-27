import { it, expect, vi, afterEach } from "vitest";
import { fetchText } from "../packages/pipeline/src/fetch";
import type { Source } from "../packages/domain/src";
const source = { url: "https://example.com" } as Source;
afterEach(() => {
  vi.unstubAllGlobals();
});
it("does not retry denied access or follow a redirect to another publisher", async () => {
  const mock = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
  vi.stubGlobal("fetch", mock);
  await expect(
    fetchText("https://example.com/article", source),
  ).rejects.toThrow("HTTP 403");
  expect(mock).toHaveBeenCalledTimes(1);
  mock
    .mockReset()
    .mockResolvedValue(
      new Response("", {
        status: 302,
        headers: { location: "https://example.org/elsewhere" },
      }),
    );
  await expect(
    fetchText("https://example.com/article", source),
  ).rejects.toThrow("leaves approved publisher");
  expect(mock).toHaveBeenCalledTimes(1);
});
it("follows a bounded canonical redirect within the approved publisher", async () => {
  const mock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("", { status: 301, headers: { location: "/article/" } }),
    )
    .mockResolvedValueOnce(new Response("Original content"));
  vi.stubGlobal("fetch", mock);
  expect(await fetchText("https://example.com/article", source)).toBe(
    "Original content",
  );
  expect(mock).toHaveBeenCalledTimes(2);
});
it("rejects oversized declared responses before reading them", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("too large", { headers: { "content-length": "9000000" } }),
      ),
  );
  await expect(fetchText("https://example.com/feed", source)).rejects.toThrow(
    "too large",
  );
});
