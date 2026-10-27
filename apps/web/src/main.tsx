import React, {
  useEffect,
  useState,
  Fragment,
  Component,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  DatasetSchema,
  series,
  observations,
  change,
  topicFromSearch,
  DAY,
  type Dataset,
  type Topic,
} from "../../../packages/domain/src";
import "./style.css";
import { COLORS, date } from "./format";
import { Chart } from "./Chart";
function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="12" />
      <circle cx="15" cy="15" r="6" />
      <path d="M15 3v12l8-8M3 15h5m7 7v5m7-12h5" />
      <circle cx="15" cy="15" r="1" />
    </svg>
  );
}
function Dashboard({ d }: { d: Dataset }) {
  const [days, setDays] = useState(180),
    [expanded, setExpanded] = useState<string | null>(() =>
      topicFromSearch(location.search, d.topics),
    ),
    [selected, setSelected] = useState(
      d.topics
        .filter((t) => d.signals.some((s) => s.topicIds.includes(t.id)))
        .slice(0, 3)
        .map((t) => t.id),
    ),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("activity"),
    [modal, setModal] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    const listener = () =>
      setExpanded(topicFromSearch(location.search, d.topics));
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, [d]);
  useEffect(() => {
    if (modal) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setModal(null);
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [modal]);
  const end = Date.parse(d.updatedAt),
    count = (id: string) => observations(d, id, end - days * DAY, end).length;
  const observedTopics = d.topics.filter(
    (t) =>
      t.status === "active" && d.signals.some((s) => s.topicIds.includes(t.id)),
  );
  const topics = observedTopics
    .filter((t) =>
      (t.name + " " + t.category).toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "recent"
          ? Math.max(
              ...d.signals
                .filter((s) => s.topicIds.includes(b.id))
                .map((s) => Date.parse(s.publishedAt)),
            ) -
            Math.max(
              ...d.signals
                .filter((s) => s.topicIds.includes(a.id))
                .map((s) => Date.parse(s.publishedAt)),
            )
          : count(b.id) - count(a.id),
    );
  const toggle = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    const u = new URL(location.href);
    next
      ? u.searchParams.set("topic", d.topics.find((t) => t.id === id)!.slug)
      : u.searchParams.delete("topic");
    history.pushState(null, "", u);
    setCopied(false);
  };
  const verified = d.signals.filter((s) => s.verificationStatus === "verified"),
    groups = new Set(
      verified.map(
        (s) => d.sources.find((x) => x.id === s.sourceId)!.independentGroup,
      ),
    );
  const stale = Date.now() - end > 7 * DAY;
  return (
    <>
      <a className="skip" href="#topics">
        Skip to topics
      </a>
      <div className="shell">
        <header>
          <a className="brand" href="./" aria-label="AI Engineering Radar home">
            <Mark />
            <span>
              AI ENGINEERING <b>RADAR</b>
            </span>
          </a>
          <span className="header-note">
            <i />
            Independent observations
          </span>
        </header>
        <main>
          <section className="intro">
            <div>
              <p className="eyebrow">AN OBSERVATORY, NOT A PLAYBOOK</p>
              <h1>
                The pulse of
                <br className="mobile-br" /> AI engineering<span>.</span>
              </h1>
              <p className="lede">
                Engineering practices, through the lens of real evidence.
                <br />
                See what’s being explored. Follow how it changes.
              </p>
            </div>
            <div className="update">
              <span className="live-dot" />{" "}
              {stale ? "Update overdue" : "Latest collection"}
              <b>{date(d.updatedAt)}</b>
              <small>Collection every three days</small>
            </div>
          </section>
          <section className="stats" aria-label="Dataset overview">
            <div>
              <strong>
                {observedTopics.length.toString().padStart(2, "0")}
              </strong>
              <span>observed topics</span>
            </div>
            <div>
              <strong>{verified.length}</strong>
              <span>verified signals</span>
            </div>
            <div>
              <strong>{groups.size.toString().padStart(2, "0")}</strong>
              <span>independent publishers</span>
            </div>
            <p>
              Observed activity ≠ effectiveness.
              <br />
              <button
                className="text-button"
                onClick={() => setModal("methodology")}
              >
                Understand the measurements <span>↗</span>
              </button>
            </p>
          </section>
          <section className="activity panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE LONGER VIEW</p>
                <h2>Activity over time</h2>
              </div>
              <div className="ranges" aria-label="Date range">
                {[30, 90, 180].map((n) => (
                  <button
                    key={n}
                    aria-pressed={days === n}
                    onClick={() => setDays(n)}
                  >
                    {n}D
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-meta">
              <span>VERIFIED SIGNALS / WEEK</span>
              <span>By publication date · UTC</span>
            </div>
            <Chart
              d={d}
              topics={d.topics.filter((t) => selected.includes(t.id))}
              days={days}
            />
            <div className="legend" aria-label="Visible topic series">
              {d.topics
                .filter((t) => d.signals.some((s) => s.topicIds.includes(t.id)))
                .map((t) => {
                  const on = selected.includes(t.id),
                    idx = d.topics
                      .filter((t) => selected.includes(t.id))
                      .findIndex((s) => s.id === t.id);
                  return (
                    <button
                      key={t.id}
                      aria-pressed={on}
                      title={
                        on
                          ? "Hide series"
                          : selected.length >= 4
                            ? "Select up to four topics"
                            : "Show series"
                      }
                      onClick={() =>
                        setSelected(
                          on
                            ? selected.length > 1
                              ? selected.filter((s) => s !== t.id)
                              : selected
                            : selected.length < 4
                              ? [...selected, t.id]
                              : [...selected.slice(1), t.id],
                        )
                      }
                    >
                      <i style={{ background: on ? COLORS[idx] : "#444a49" }} />
                      {t.name}
                    </button>
                  );
                })}
            </div>
            <p className="coverage-note">
              <span>◌</span> Partial historical coverage. Counts are observed
              lower bounds; gaps mean uncollected data, never zero.{" "}
              <button onClick={() => setModal("coverage")}>
                View coverage ↗
              </button>
            </p>
          </section>
          <section id="topics" className="topics">
            <div className="section-heading">
              <div>
                <p className="eyebrow">FOLLOW THE SIGNAL</p>
                <h2>
                  Engineering topics{" "}
                  <span className="counter">{topics.length}</span>
                </h2>
              </div>
              <p className="section-hint">
                Select a topic to explore the evidence
              </p>
            </div>
            <div className="filters">
              <label>
                <span className="sr-only">Search topics</span>
                <span aria-hidden="true">⌕</span>
                <input
                  placeholder="Find a topic…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">Sort topics</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="activity">Most observed</option>
                  <option value="recent">Latest publication</option>
                  <option value="name">Alphabetical</option>
                </select>
              </label>
            </div>
            <div className="row-head">
              <span>TOPIC / AREA</span>
              <span>LAST {days} DAYS</span>
              <span>SIGNALS</span>
              <span>CHANGE¹</span>
              <span />
            </div>
            {!topics.length && (
              <p className="empty">{verified.length ? "No topics match your search." : "No verified observations have been collected yet."}</p>
            )}
            {topics.map((t, i) => {
              const open = expanded === t.id,
                c = change(d, t.id, days),
                signals = observations(d, t.id, end - days * DAY, end).sort(
                  (a, b) => b.publishedAt.localeCompare(a.publishedAt),
                );
              return (
                <Fragment key={t.id}>
                  <button
                    className={`topic-row ${open ? "is-open" : ""}`}
                    aria-expanded={open}
                    aria-controls={"detail-" + t.id}
                    onClick={() => toggle(t.id)}
                  >
                    <span className="topic-title">
                      <span className="row-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{t.name}</strong>
                        <small>{t.category}</small>
                      </span>
                    </span>
                    <Chart d={d} topics={[t]} days={days} small />
                    <span className="signal-count">{signals.length}</span>
                    <span className="trend-label">
                      {c.delta !== null
                        ? `${c.delta > 0 ? "+" : ""}${c.delta}%`
                        : "—"}
                      <small>{c.label}</small>
                    </span>
                    <span className="expand" aria-hidden="true">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="topic-detail" id={"detail-" + t.id}>
                      <div className="detail-heading">
                        <div>
                          <p className="eyebrow">TOPIC OBSERVATIONS</p>
                          <h3>{t.name}</h3>
                          <p>{t.description}</p>
                        </div>
                        <button
                          className="share"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                location.href,
                              );
                              setCopied(true);
                            } catch {
                              setCopied(false);
                            }
                          }}
                        >
                          {copied ? "Link copied ✓" : "Copy topic link ↗"}
                        </button>
                      </div>
                      <div className="detail-metrics">
                        <span>
                          <b>{signals.length}</b> verified signals
                        </span>
                        <span>
                          <b>
                            {
                              new Set(
                                signals.map(
                                  (s) =>
                                    d.sources.find((x) => x.id === s.sourceId)!
                                      .independentGroup,
                                ),
                              ).size
                            }
                          </b>{" "}
                          independent publishers
                        </span>
                        <span>
                          <b>
                            {
                              signals.filter(
                                (s) => s.type === "production-case",
                              ).length
                            }
                          </b>{" "}
                          documented production cases
                        </span>
                      </div>
                      <Chart d={d} topics={[t]} days={days} />
                      <p className="detail-note">
                        Partial collection. The earliest observation is not the
                        origin of this practice. Publication excerpts below are
                        attributed to their original authors.
                      </p>
                      <h4>
                        Evidence trail{" "}
                        <span>{signals.length} publications in this range</span>
                      </h4>
                      {signals.length === 0 && (
                        <p className="empty">
                          No verified publications collected for this topic in
                          this range. Try 180 days.
                        </p>
                      )}
                      {signals.map((s) => (
                        <article className="evidence" key={s.id}>
                          <div>
                            <span className="evidence-type">
                              {s.type.replaceAll("-", " ")}
                            </span>
                            <span>
                              {d.sources.find((x) => x.id === s.sourceId)?.name}
                            </span>
                          </div>
                          <h5>
                            <a
                              href={s.canonicalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {s.title} <span>↗</span>
                            </a>
                          </h5>
                          <blockquote>{s.summary}</blockquote>
                          <p className="evidence-date">
                            Published {date(s.publishedAt)} <span>·</span>{" "}
                            Observed {date(s.observedAt)}
                          </p>
                          <details>
                            <summary>Verification notes</summary>
                            <p>{s.evidenceNotes}</p>
                          </details>
                        </article>
                      ))}
                      <button
                        className="close-detail"
                        onClick={() => toggle(t.id)}
                      >
                        Close topic ↑
                      </button>
                    </div>
                  )}
                </Fragment>
              );
            })}
            <p className="footnote">
              ¹ Change compares equal halves of the selected range. Percentages
              require comparable coverage and at least three prior signals. “—”
              means insufficient evidence for comparison.
            </p>
          </section>
          <aside className="principle">
            <Mark />
            <p>
              Popularity is a signal.
              <br />
              <strong>It isn’t a recommendation.</strong>
            </p>
            <span>
              Original sources. Transparent measurements.
              <br />A clearer view of a changing field.
            </span>
          </aside>
        </main>
        <footer>
          <span>
            AI Engineering Radar <span className="muted">/</span> Observe. Do
            not recommend.
          </span>
          <div>
            <button onClick={() => setModal("methodology")}>Methodology</button>
            <button onClick={() => setModal("sources")}>Sources</button>
            <button onClick={() => setModal("about")}>About & status</button>
          </div>
        </footer>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <dialog
            aria-modal="true"
            aria-labelledby="dialog-title"
            ref={(el) => {
              if (el && !el.open) el.showModal();
            }}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              ×
            </button>
            <p className="eyebrow">BEHIND THE OBSERVATIONS</p>
            <h2 id="dialog-title">
              {modal === "methodology"
                ? "How we measure"
                : modal === "sources"
                  ? "The source set"
                  : modal === "coverage"
                    ? "Historical coverage"
                    : "About this observatory"}
            </h2>
            {modal === "methodology" ? (
              <>
                <p>
                  We count unique, verified publications associated with
                  engineering topics in a curated source set. Weekly counts use
                  the publisher’s publication date, in UTC. The final week can
                  be shorter than seven days.
                </p>
                <p>
                  Each publication is retrieved and its excerpt checked against
                  the original page. Canonical URLs and explicit event
                  identifiers remove duplicates. Channels from the same
                  organization share an independent publisher group.
                </p>
                <p>
                  Topic assignment uses explicit, versioned phrases. Ambiguous
                  attribution and unsupported content go to review. Automatic
                  collection classifies technical publications conservatively;
                  production use requires human verification.
                </p>
                <p>
                  Counts show observed publishing activity. They cannot
                  establish developer adoption, engineering effectiveness,
                  consensus, or return on investment. Source concentration and
                  incomplete archives limit comparisons.
                </p>
                <p>
                  Trend labels compare the two equal halves of your selected
                  date range. Percentage changes are withheld for partial
                  coverage or a prior count below three. Zero-baseline increases
                  are newly observed only when coverage is comparable.
                </p>
              </>
            ) : modal === "sources" ? (
              <>
                <p>
                  Original engineering publications and independent
                  practitioners. Source selection favors attributable technical
                  detail. Registry membership alone does not make a claim
                  verified.
                </p>
                {d.sources.map((s) => (
                  <p key={s.id}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.name} ↗
                    </a>
                    <small className="block">
                      {verified.filter((x) => x.sourceId === s.id).length}{" "}
                      verified publications · independent group:{" "}
                      {s.independentGroup}
                    </small>
                  </p>
                ))}
                <p>
                  Largest publisher share:{" "}
                  {Math.round(
                    (Math.max(
                      0,
                      ...d.sources.map(
                        (s) =>
                          verified.filter((x) => x.sourceId === s.id).length,
                      ),
                    ) /
                      Math.max(1, verified.length)) *
                      100,
                  )}
                  %. This curated sample is not representative of the entire
                  industry.
                </p>
              </>
            ) : modal === "coverage" ? (
              <>
                <p>
                  Archives and feeds have different retention limits. All
                  initial backfill is marked partial. Positive counts are
                  verified lower bounds; a missing observation does not
                  establish that no publication existed.
                </p>
                {d.coverage.map((c) => (
                  <p key={c.sourceId}>
                    <b>{d.sources.find((s) => s.id === c.sourceId)?.name}</b>
                    <small className="block">
                      {date(c.start)} — {date(c.end)} · {c.status}
                    </small>
                    {c.basis}
                  </p>
                ))}
              </>
            ) : (
              <>
                <p>
                  An independent, public observatory of how AI engineering
                  practices are discussed and documented. One dashboard,
                  source-backed observations, no adoption recommendations.
                </p>
                <p>
                  Dataset: {d.coverageVersion}. Last successful collection:{" "}
                  {date(d.updatedAt)}. All timestamps use UTC.
                </p>
                <p>
                  * Collection is designed to run every three days through
                  GitHub Actions. Check the operational handover for activation
                  status. When collection fails, the last validated dataset
                  remains available. Data older than seven days is marked
                  overdue.
                </p>
              </>
            )}
          </dialog>
        </div>
      )}
    </>
  );
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal">
        <h1>Observations unavailable</h1>
        <p>The dataset could not be displayed. Please try again later.</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    import("../../../data/dataset.json")
      .then((m) => setData(DatasetSchema.parse(m.default)))
      .catch(() => setError(true));
  }, []);
  return error ? (
    <div className="fatal">
      <h1>Observations unavailable</h1>
      <p>The latest dataset could not be validated.</p>
      <button onClick={() => location.reload()}>Retry</button>
    </div>
  ) : data ? (
    <Dashboard d={data} />
  ) : (
    <div className="fatal" role="status">
      <Mark />
      <p>Loading verified observations…</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
