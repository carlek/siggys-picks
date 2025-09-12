'use server';

import { load } from 'cheerio';
import he from 'he';

export interface TeamStats {
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  powerPlayPct: number | null;
  penaltyKillPct: number | null;
}

export interface GameStats {
  away: TeamStats;
  home: TeamStats;
}

const DEFAULT_STATS: TeamStats = {
  goalsForPerGame: null,
  goalsAgainstPerGame: null,
  powerPlayPct: null,
  penaltyKillPct: null,
};

function toNum(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d.+\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractTeamStatsCard(html: string): TeamStats {
  const decoded = he.decode(html);
  const $ = load(decoded);

  // Scope to the Team Stats card to avoid collisions
  const section = $('#rankings__Module');

  const stats: TeamStats = { ...DEFAULT_STATS };

  section.find('.TeamStat__Item').each((_, el) => {
    const label = $(el).find('.n8, .tc').first().text().trim();
    // Big number usually carries class "h2"
    const valueText =
      $(el).find('.h2').first().text().trim() ||
      $(el).find('.tc').eq(1).text().trim();

    const value = toNum(valueText);

    if (/goals\s*for/i.test(label)) {
      stats.goalsForPerGame = value;
    } else if (/goals\s*against/i.test(label)) {
      stats.goalsAgainstPerGame = value;
    } else if (/power\s*play/i.test(label)) {
      stats.powerPlayPct = value;
    } else if (/penalty\s*kill/i.test(label)) {
      stats.penaltyKillPct = value;
    }
  });
  return stats;
}

export async function fetchTeamStatsByTeam(teamAbbr: string): Promise<TeamStats> {

  const url = `https://www.espn.com/nhl/team/_/name/${teamAbbr}`
  if (!url) return { ...DEFAULT_STATS };

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Team page HTTP ${res.status}`);
    const html = await res.text();
    return extractTeamStatsCard(html);
  } catch (err) {
    console.error('fetchTeamStatsByTeamObj error:', err);
    return { ...DEFAULT_STATS };
  }
}

// single event stats 
export async function getStats(eventId: string | number): Promise<GameStats | null> {
  try {
    // low to discover team pages
    const sumUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${eventId}`;
    const res = await fetch(sumUrl, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`ESPN summary HTTP ${res.status}`);
    const json = await res.json();

    const comp = Array.isArray(json?.competitions) ? json.competitions[0] : json?.header?.competitions?.[0];
    if (!comp) {
      console.warn('No competition info in summary JSON.');
      return null;
    }

    const home = comp.competitors?.find((c: any) => c?.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c?.homeAway === 'away');
    const homeTeam = home?.team;
    const awayTeam = away?.team;

    if (!homeTeam || !awayTeam) {
      console.warn('Missing home/away team info in summary JSON.');
      return null;
    }

    // Fetch both team pages in parallel
    const [awayStats, homeStats] = await Promise.all([
      fetchTeamStatsByTeam(awayTeam.abbreviation),
      fetchTeamStatsByTeam(homeTeam.abbreviation),
    ]);

    return { away: awayStats, home: homeStats };
  } catch (err) {
    console.error('getStats error:', err);
    return null;
  }
}

// multiple event stats
export async function getStatsForEvents(
  eventIds: Array<string | number>
): Promise<Record<string, GameStats | null>> {
  const entries = await Promise.allSettled(
    eventIds.map((id) => getStats(id).then((stats) => [String(id), stats] as const))
  );
  const out: Record<string, GameStats | null> = {};
  for (const r of entries) {
    if (r.status === 'fulfilled') {
      const [id, stats] = r.value;
      out[id] = stats;
    }
  }
  return out;
}
