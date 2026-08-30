// ESPN's endpoints sit behind Akamai. Logs showed the scoreboard call (hit once per
// page load) never gets blocked, while the summary endpoint (hit once per game for
// odds/stats, all fired concurrently via Promise.allSettled in nhl-espn-api.ts, plus
// again for article extraction) fails consistently — a rate limit on that specific
// endpoint tripped by the burst, not a blanket IP ban. Retries alone don't help
// because the whole burst shares one rate-limit window. A global concurrency cap
// (below) smooths the burst; browser-like headers and retry-with-backoff handle the
// remaining edge-level 403s.
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

// Caps concurrent outbound ESPN requests per server instance (a games-list load can
// otherwise fan out a dozen-plus simultaneous summary/team-stat fetches at once).
const MAX_CONCURRENT_ESPN_REQUESTS = 3;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_ESPN_REQUESTS) {
    activeRequests++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeRequests++;
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

export async function espnFetch(
  url: string,
  init?: RequestInit,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 2, baseDelayMs = 300 } = opts;
  const headers = { ...ESPN_HEADERS, ...(init?.headers || {}) };

  await acquireSlot();
  try {
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
  } finally {
    releaseSlot();
  }
}
