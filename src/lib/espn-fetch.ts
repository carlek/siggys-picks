// ESPN's endpoints sit behind Akamai, which occasionally 403s server-side traffic
// (bot/rate-limit heuristics on datacenter IPs and request bursts) even though the
// exact same request succeeds moments later or from a different source. Browser-like
// headers reduce the odds of being flagged, and a short retry-with-backoff absorbs
// the transient blocks so one bad edge response doesn't fail the whole page load.
const ESPN_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.espn.com/",
};

const RETRYABLE_STATUSES = new Set([403, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function espnFetch(
  url: string,
  init?: RequestInit,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 2, baseDelayMs = 300 } = opts;
  const headers = { ...ESPN_HEADERS, ...(init?.headers || {}) };

  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { ...init, headers });
    if (res.ok) return res;

    lastResponse = res;
    if (!RETRYABLE_STATUSES.has(res.status) || attempt === retries) {
      return res;
    }

    const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
    console.warn(
      `espnFetch: ${res.status} from ${url}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`
    );
    await sleep(delay);
  }

  return lastResponse!;
}
