import { useState } from "react";
import { series, type Dataset, type Topic } from "../../../packages/domain/src";
import { COLORS, date } from "./format";
export function Chart({
  d,
  topics,
  days,
  small = false,
}: {
  d: Dataset;
  topics: Topic[];
  days: number;
  small?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 900,
    height = small ? 48 : 260,
    pad = small ? 3 : 36;
  const lines = topics.map((t) => ({
    topic: t,
    points: series(d, t.id, days),
  }));
  const length = lines[0]?.points.length ?? 1,
    max =
      Math.ceil(
        Math.max(
          3,
          ...lines.flatMap((l) => l.points.map((p) => p.signalCount ?? 0)),
        ) / 3,
      ) * 3;
  const x = (i: number) =>
    pad + (i / Math.max(1, length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  return (
    <div className={small ? "spark" : "chart-wrap"}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          small
            ? "Weekly observed signal counts"
            : "Weekly verified signals by publication date. Gaps indicate uncollected periods. Counts are lower bounds in partial coverage."
        }
        preserveAspectRatio={small ? "none" : "xMidYMid meet"}
      >
        {!small &&
          [0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line
                x1={pad}
                x2={width - pad}
                y1={y((max * i) / 3)}
                y2={y((max * i) / 3)}
                stroke="#2a2e30"
                strokeDasharray={i ? "3 5" : undefined}
              />
              <text
                x="10"
                y={y((max * i) / 3) + 4}
                fill="#89908e"
                fontSize="11"
              >
                {Math.round((max * i) / 3)}
              </text>
            </g>
          ))}
        {lines.map(({ topic, points }, j) => (
          <g
            key={topic.id}
            stroke={COLORS[j % COLORS.length]}
            fill="none"
            strokeWidth={small ? 5 : 2}
          >
            {points.map((p, i) =>
              p.signalCount !== null &&
              i > 0 &&
              points[i - 1].signalCount !== null ? (
                <line
                  key={"l" + i}
                  x1={x(i - 1)}
                  y1={y(points[i - 1].signalCount!)}
                  x2={x(i)}
                  y2={y(p.signalCount)}
                />
              ) : null,
            )}
            {points.map((p, i) =>
              p.signalCount !== null ? (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(p.signalCount)}
                  r={small ? 5 : 3}
                  fill={COLORS[j % COLORS.length]}
                >
                  <title>
                    {topic.name}: {p.signalCount} verified signals,{" "}
                    {date(p.periodStart)}–{date(p.periodEnd)} (partial coverage)
                  </title>
                </circle>
              ) : null,
            )}
          </g>
        ))}
        {!small &&
          lines[0]?.points
            .filter(
              (_, i) =>
                i === 0 || i === length - 1 || i === Math.floor(length / 2),
            )
            .map((p) => (
              <text
                key={p.periodStart}
                x={x(lines[0].points.indexOf(p))}
                y={height - 6}
                textAnchor={
                  p === lines[0].points[0]
                    ? "start"
                    : p === lines[0].points[length - 1]
                      ? "end"
                      : "middle"
                }
                fill="#89908e"
                fontSize="11"
              >
                {date(p.periodStart)}
              </text>
            ))}
        {!small &&
          lines[0]?.points.map((p, i) => (
            <rect
              key={i}
              x={x(i) - (width - pad * 2) / length / 2}
              y={0}
              width={(width - pad * 2) / length}
              height={height - pad}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${date(p.periodStart)}: ${lines.map((l) => `${l.topic.name} ${l.points[i].signalCount ?? "uncollected"}`).join(", ")}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
            />
          ))}
      </svg>
      {!small && hover !== null && (
        <div className="tooltip" role="status">
          <b>Week of {date(lines[0].points[hover].periodStart)}</b>
          {lines.map((l, j) => (
            <span key={l.topic.id}>
              <i style={{ background: COLORS[j] }} />
              {l.topic.name}
              <strong>{l.points[hover].signalCount ?? "—"}</strong>
            </span>
          ))}
        </div>
      )}
      {!small && (
        <details className="chart-data">
          <summary>View accessible chart data</summary>
          <div className="data-grid">
            {lines[0]?.points.map((p, i) => (
              <p key={i}>
                <b>{date(p.periodStart)}</b>
                {lines.map((l) => (
                  <span key={l.topic.id}>
                    {l.topic.name}: {l.points[i].signalCount ?? "Uncollected"}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
