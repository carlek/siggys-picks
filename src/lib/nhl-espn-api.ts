import { GameOdds, parseEspnOdds } from "./nhl-odds";
import { GameStats, fetchTeamStatsByTeam } from "./nhl-stats";


// Single fetch of ESPN summary (shared)
export async function fetchEspnSummary(eventId: string | number): Promise<any | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${eventId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`ESPN summary HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('fetchEspnSummary error:', err);
    return null;
  }
}

// Extract odds from a pre-fetched summary
export async function oddsFromSummary(summary: any): Promise<GameOdds | null> {
  if (!summary) return null;
  return await parseEspnOdds(summary);
}

// Extract stats from a pre-fetched summary (uses team abbreviations found inside it)
export async function statsFromSummary(summary: any): Promise<GameStats | null> {
  if (!summary) return null;

  // Try both shapes; ESPN varies
  const comp =
    Array.isArray(summary?.competitions) ? summary.competitions[0] :
    summary?.header?.competitions?.[0];

  if (!comp) {
    console.warn('statsFromSummary: no competition info in summary.');
    return null;
  }

  const home = comp.competitors?.find((c: any) => c?.homeAway === 'home');
  const away = comp.competitors?.find((c: any) => c?.homeAway === 'away');
  const homeTeam = home?.team;
  const awayTeam = away?.team;

  if (!homeTeam || !awayTeam) {
    console.warn('statsFromSummary: missing home/away team info.');
    return null;
  }

  // Fetch both team pages in parallel
  const [awayStats, homeStats] = await Promise.all([
    fetchTeamStatsByTeam(String(awayTeam.abbreviation || '').toLowerCase()),
    fetchTeamStatsByTeam(String(homeTeam.abbreviation || '').toLowerCase()),
  ]);

  return { away: awayStats, home: homeStats };
}

// Convenience: get BOTH from one summary fetch
export async function getOddsAndStats(eventId: string | number): Promise<{
  odds: GameOdds | null;
  stats: GameStats | null;
  summary: any | null;
}> {
  const summary = await fetchEspnSummary(eventId);
  if (!summary) return { odds: null, stats: null, summary: null };

  const [odds, stats] = await Promise.all([
    Promise.resolve(oddsFromSummary(summary)),   // purely synchronous extraction
    statsFromSummary(summary),                   // async (scrapes two team pages)
  ]);

  return { odds, stats, summary };
}

// Batch: fetch each summary once, then extract both for all
export async function getOddsAndStatsForEvents(
  eventIds: Array<string | number>
): Promise<Record<string, { odds: GameOdds | null; stats: GameStats | null }>> {
  const results: Record<string, { odds: GameOdds | null; stats: GameStats | null }> = {};
  const entries = await Promise.allSettled(
    eventIds.map(async (id) => {
      const summary = await fetchEspnSummary(id);
      if (!summary) return [String(id), { odds: null, stats: null }] as const;

      const [odds, stats] = await Promise.all([
        Promise.resolve(oddsFromSummary(summary)),
        statsFromSummary(summary),
      ]);
      return [String(id), { odds, stats }] as const;
    })
  );

  for (const r of entries) {
    if (r.status === 'fulfilled') {
      const [id, val] = r.value;
      results[id] = val;
    }
  }
  return results;
}
