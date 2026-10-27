# Evidence and editorial policy

Publish attributable original technical observations. Prefer engineering reports, transparent experiments, and concrete implementation details. Publisher credibility does not establish each claim's strength. Marketing claims and tutorials do not establish production usage.

A verified signal must have a retrievable HTTPS primary URL, a grounded publication timestamp, an identifiable source group, supported excerpt, relevant existing topic mapping, and a unique event identity. Keep uncertain records out of public metrics. Rewritten announcements, syndicated events, and quotations of other publishers require attribution review.

When reviewing `data/review.json`, fetch the original, establish the publisher and actual date, inspect the evidence, assign existing topics, and compare URL/event identities with the full dataset. Add an `originalEventId` whenever multiple publications concern the same event. New topics require a clear neutral definition and a taxonomy check against existing aliases. Record the review basis in `evidenceNotes`. A production case needs explicit primary evidence of deployed use and a supporting quotation or description in the notes. Never infer it from a product announcement.

Publication excerpts remain attributed to authors. Observatory text must remain neutral. Activity counts, rising/declining labels, and source counts are measurements of this sample, never recommendations or quality scores.

Fixtures belong under `tests/` and use clearly artificial domains/text. Never put fixtures in `data/dataset.json`. Correct or withdraw inaccurate signals through version-controlled changes and rebuild the site. Preserve review history through Git rather than a mutable editorial database.
