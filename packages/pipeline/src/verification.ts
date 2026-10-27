import type { Signal } from "../../domain/src/index";
const words = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function possibleDuplicate(
  candidate: Pick<Signal, "title" | "excerpt" | "canonicalUrl" | "publishedAt">,
  existing: Signal[],
): Signal | undefined {
  const title = words(candidate.title),
    excerpt = words(candidate.excerpt),
    tokens = title.split(" ");
  return existing.find((s) => {
    if (s.canonicalUrl === candidate.canonicalUrl) return true;
    if (
      Math.abs(Date.parse(s.publishedAt) - Date.parse(candidate.publishedAt)) >
      7 * 86400000
    )
      return false;
    if (excerpt.length >= 120 && excerpt === words(s.excerpt)) return true;
    if (tokens.length < 5) return false;
    const a = new Set(tokens),
      b = new Set(words(s.title).split(" "));
    const overlap = [...a].filter((w) => b.has(w)).length;
    return overlap / new Set([...a, ...b]).size >= 0.85;
  });
}
