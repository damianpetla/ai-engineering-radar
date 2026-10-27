import { it, expect } from "vitest";
import { possibleDuplicate } from "../packages/pipeline/src/verification";
import type { Signal } from "../packages/domain/src";
const existing = {
  title: "Introducing a new sandbox for coding agents",
  excerpt:
    "A distinctive original publication with concrete technical details, a verified original source, and enough attributed text to detect exact syndication across publishers.",
  canonicalUrl: "https://example.com/original",
  publishedAt: "2026-10-20T00:00:00Z",
} as Signal;
it("routes a republished headline or identical attributed text to review rather than inflating events", () => {
  expect(
    possibleDuplicate(
      { ...existing, canonicalUrl: "https://example.org/copy" },
      [existing],
    ),
  ).toBe(existing);
  expect(
    possibleDuplicate(
      {
        ...existing,
        title: "A different headline for a copied article",
        canonicalUrl: "https://example.org/copy",
      },
      [existing],
    ),
  ).toBe(existing);
});
it("keeps independently written discussions of the same general topic", () => {
  expect(
    possibleDuplicate(
      {
        title: "Context engineering",
        excerpt:
          "A distinct first-party experiment with its own methods and results.",
        canonicalUrl: "https://example.org/discussion",
        publishedAt: existing.publishedAt,
      },
      [{ ...existing, title: "Context engineering" }],
    ),
  ).toBeUndefined();
});
