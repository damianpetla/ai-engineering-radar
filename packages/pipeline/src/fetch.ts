import type { Source } from "../../domain/src/index";
class PermanentSourceError extends Error {}
export async function fetchText(url: string, source: Source): Promise<string> {
  const origin = new URL(source.url);
  let target = new URL(url);
  if (target.protocol !== "https:" || target.hostname !== origin.hostname)
    throw new PermanentSourceError(`Unapproved host: ${target.hostname}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      for (let redirect = 0; redirect < 4; redirect++) {
        const res = await fetch(target.href, {
          headers: {
            "User-Agent":
              "AIEngineeringRadar/1.1 (public engineering observatory; bounded evidence collection)",
          },
          signal: AbortSignal.timeout(20000),
          redirect: "manual",
        });
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location)
            throw new PermanentSourceError("Redirect without location");
          const next = new URL(location, target);
          if (next.protocol !== "https:" || next.hostname !== origin.hostname)
            throw new PermanentSourceError(
              "Redirect leaves approved publisher",
            );
          target = next;
          continue;
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 429)
          throw new PermanentSourceError(`HTTP ${res.status}: ${target.href}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${target.href}`);
        const limit = 8_000_000;
        if (Number(res.headers.get("content-length") ?? 0) > limit)
          throw new PermanentSourceError("Response too large");
        if (!res.body) throw new Error("Empty response");
        const reader = res.body.getReader(),
          chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > limit) {
            await reader.cancel();
            throw new PermanentSourceError("Response too large");
          }
          chunks.push(value);
        }
        return Buffer.concat(chunks).toString("utf8");
      }
      throw new PermanentSourceError("Too many redirects");
    } catch (e) {
      if (attempt === 2 || e instanceof PermanentSourceError) throw e;
      await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
    }
  }
  throw new Error("Fetch failed");
}
