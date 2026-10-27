import { z } from "zod";
const instant = z.string().datetime({ offset: true });
const url = z
  .string()
  .url()
  .refine((v) => v.startsWith("https://"), "HTTPS required");
export const SourceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    url,
    type: z.enum([
      "engineering-blog",
      "research",
      "documentation",
      "repository",
      "technical-talk",
      "other",
    ]),
    organization: z.string().optional(),
    independentGroup: z.string(),
    enabled: z.boolean(),
    discoveredAt: instant,
    feedUrl: url.optional(),
    discoveryUrl: url.optional(),
    archiveBase: url.optional(),
  })
  .strict();
export const TopicSchema = z
  .object({
    id: z.string(),
    slug: z.string().regex(/^[a-z][a-z0-9-]+$/),
    name: z.string(),
    description: z.string(),
    category: z.string(),
    aliases: z.array(z.string()),
    createdAt: instant,
    status: z.enum(["active", "archived"]),
  })
  .strict();
export const SignalSchema = z
  .object({
    id: z.string(),
    sourceId: z.string(),
    canonicalUrl: url,
    title: z.string().min(1),
    publishedAt: instant,
    observedAt: instant,
    topicIds: z.array(z.string()).min(1),
    type: z.enum([
      "announcement",
      "technical-explanation",
      "independent-experiment",
      "production-case",
      "research-result",
      "repository-activity",
    ]),
    summary: z.string().min(1),
    originalEventId: z.string().optional(),
    verificationStatus: z.enum(["verified", "review"]),
    evidenceNotes: z.string(),
    contentHash: z.string(),
    excerpt: z.string().min(1),
  })
  .strict();
export const CoverageSchema = z
  .object({
    sourceId: z.string(),
    start: instant,
    end: instant,
    status: z.enum(["partial", "complete"]),
    basis: z.string(),
  })
  .strict();
export const SnapshotSchema = z
  .object({
    topicId: z.string(),
    periodStart: instant,
    periodEnd: instant,
    signalCount: z.number().int().nonnegative().nullable(),
    independentSourceCount: z.number().int().nonnegative().nullable(),
    productionCaseCount: z.number().int().nonnegative().nullable(),
    coverageVersion: z.string(),
    computedAt: instant,
  })
  .strict();
export const DatasetSchema = z
  .object({
    version: z.literal(1),
    coverageVersion: z.string(),
    updatedAt: instant,
    sources: z.array(SourceSchema),
    topics: z.array(TopicSchema),
    signals: z.array(SignalSchema),
    coverage: z.array(CoverageSchema),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ids = (xs: { id: string }[], kind: string) => {
      if (new Set(xs.map((x) => x.id)).size !== xs.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${kind} IDs` });
    };
    ids(d.sources, "source");
    ids(d.topics, "topic");
    ids(d.signals, "signal");
    const sources = new Set(d.sources.map((x) => x.id)),
      topics = new Set(d.topics.map((x) => x.id)),
      urls = new Set<string>();
    for (const s of d.signals) {
      if (!sources.has(s.sourceId) || s.topicIds.some((t) => !topics.has(t)))
        ctx.addIssue({ code: "custom", message: `Broken reference: ${s.id}` });
      if (Date.parse(s.publishedAt) > Date.parse(s.observedAt))
        ctx.addIssue({
          code: "custom",
          message: `Future publication: ${s.id}`,
        });
      if (s.verificationStatus === "verified" && urls.has(s.canonicalUrl))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate URL: ${s.canonicalUrl}`,
        });
      if (s.verificationStatus === "verified") urls.add(s.canonicalUrl);
    }
    for (const c of d.coverage)
      if (!sources.has(c.sourceId) || c.start >= c.end)
        ctx.addIssue({ code: "custom", message: "Invalid coverage" });
  });
export type Source = z.infer<typeof SourceSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export const DAY = 86_400_000;
export function canonicalUrl(input: string) {
  const u = new URL(input);
  if (u.protocol !== "https:") throw Error("HTTPS required");
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith("utm_") || ["ref", "fbclid", "gclid"].includes(k))
      u.searchParams.delete(k);
  u.searchParams.sort();
  u.hostname = u.hostname.toLowerCase();
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.href;
}
export function deduplicate(signals: Signal[]): Signal[] {
  const keys = new Set<string>();
  return [...signals]
    .sort(
      (a, b) =>
        a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id),
    )
    .filter((s) => {
      const k = s.originalEventId
        ? `event:${s.originalEventId}`
        : canonicalUrl(s.canonicalUrl);
      if (keys.has(k)) return false;
      keys.add(k);
      return true;
    });
}
export function matchTopics(text: string, topics: Topic[]) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return topics
    .filter((t) =>
      [t.name, ...t.aliases].some((a) =>
        normalized.includes(` ${a.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `),
      ),
    )
    .map((t) => t.id);
}
export function observations(
  d: Dataset,
  topicId: string,
  start: number,
  end: number,
) {
  return deduplicate(
    d.signals.filter(
      (s) =>
        s.verificationStatus === "verified" &&
        s.topicIds.includes(topicId) &&
        Date.parse(s.publishedAt) >= start &&
        Date.parse(s.publishedAt) < end,
    ),
  );
}
export function snapshot(
  d: Dataset,
  topicId: string,
  start: number,
  end: number,
): Snapshot {
  const signals = observations(d, topicId, start, end);
  const covered = d.coverage.some(
    (c) =>
      c.status === "complete" &&
      Date.parse(c.start) <= start &&
      Date.parse(c.end) >= end,
  );
  const count = signals.length || covered ? signals.length : null;
  return {
    topicId,
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    signalCount: count,
    independentSourceCount:
      count === null
        ? null
        : new Set(
            signals.map(
              (s) =>
                d.sources.find((x) => x.id === s.sourceId)!.independentGroup,
            ),
          ).size,
    productionCaseCount:
      count === null
        ? null
        : signals.filter((s) => s.type === "production-case").length,
    coverageVersion: d.coverageVersion,
    computedAt: d.updatedAt,
  };
}
export function series(d: Dataset, topicId: string, days: number) {
  const end = Date.parse(d.updatedAt);
  const start = Math.floor((end - days * DAY) / DAY) * DAY;
  return Array.from({ length: Math.ceil((end - start) / (7 * DAY)) }, (_, i) =>
    snapshot(
      d,
      topicId,
      start + i * 7 * DAY,
      Math.min(start + (i + 1) * 7 * DAY, end),
    ),
  );
}
export function change(d: Dataset, topicId: string, days: number) {
  const end = Date.parse(d.updatedAt),
    half = (days * DAY) / 2;
  const current = snapshot(d, topicId, end - half, end),
    prior = snapshot(d, topicId, end - 2 * half, end - half);
  const a = current.signalCount,
    b = prior.signalCount;
  const comparable = d.coverage.some(
    (c) =>
      c.status === "complete" &&
      Date.parse(c.start) <= end - 2 * half &&
      Date.parse(c.end) >= end,
  );
  if (!comparable || a === null || b === null)
    return {
      label: "Insufficient coverage",
      delta: null,
      current: a,
      prior: b,
    };
  if (b === 0)
    return {
      label: a > 0 ? "Newly observed" : "Stable",
      delta: null,
      current: a,
      prior: b,
    };
  if (b < 3)
    return { label: "Low baseline", delta: null, current: a, prior: b };
  const delta = Math.round(((a - b) / b) * 100);
  return {
    label: delta > 20 ? "Rising" : delta < -20 ? "Declining" : "Stable",
    delta,
    current: a,
    prior: b,
  };
}
export function topicFromSearch(search: string, topics: Topic[]) {
  const slug = new URLSearchParams(search).get("topic");
  return topics.find((t) => t.slug === slug)?.id ?? null;
}
