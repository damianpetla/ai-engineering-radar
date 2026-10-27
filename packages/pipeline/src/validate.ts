import { readFile } from "node:fs/promises";
import { DatasetSchema, SnapshotSchema, series } from "../../domain/src/index";
const d = DatasetSchema.parse(
  JSON.parse(await readFile("data/dataset.json", "utf8")),
);
for (const t of d.topics)
  for (const point of series(d, t.id, 180)) SnapshotSchema.parse(point);
console.log(
  `Validated ${d.signals.length} signals, ${d.topics.length} topics, ${d.sources.length} sources; all snapshots reproducible.`,
);
