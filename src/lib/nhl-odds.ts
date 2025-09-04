'use server';

export interface TeamOdds {
  moneyline: number | null;     // American odds, e.g. -120, +150
  pointSpread: number | null;
  spreadOdds: number | null;    // American odds for the spread (if present)
}

export interface GameOdds {
  provider: string | null;  
  overUnder: number | null; 
  overOdds: number | null;    
  away: TeamOdds;
  home: TeamOdds;
}

// Safe number parsing from strings like "-112" or "+250"
const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d\-\.+]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Parse ESPN summary JSON -> GameOdds ---
function parseEspnOdds(json: any): GameOdds | null {
  const pc = Array.isArray(json?.pickcenter) ? json.pickcenter : null;
  if (!pc || pc.length === 0) return null;

  // pickcenter[0] is the first book / consensus entry
  const entry = pc[0];

  const provider = entry?.provider ?? null;
  const awayMoney = entry?.awayTeamOdds?.moneyLine;
  const homeMoney = entry?.homeTeamOdds?.moneyLine;

  const awaySpreadPts = entry?.pointSpread?.away.open.line;
  const homeSpreadPts = entry?.pointSpread?.home.open.line;
  const awaySpreadOdds = entry?.awayTeamOdds?.spreadOdds;
  const homeSpreadOdds = entry?.homeTeamOdds?.spreadOdds;
  const overUnder = toNum(entry?.overUnder);
  const overOdds = toNum(entry?.overOdds);
  
  return {
    provider: typeof provider === 'string' ? provider : null,
    overUnder: overUnder,
    overOdds: overOdds,
    away: {
      moneyline: toNum(awayMoney),
      pointSpread: toNum(awaySpreadPts),
      spreadOdds: toNum(awaySpreadOdds),
    },
    home: {
      moneyline: toNum(homeMoney),
      pointSpread: toNum(homeSpreadPts),
      spreadOdds: toNum(homeSpreadOdds),
    },
  };
}

// Single odds
export async function getOdds(eventId: string | number): Promise<GameOdds | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${eventId}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } }); // cache for 60s on Next.js
    if (!res.ok) throw new Error(`ESPN odds HTTP ${res.status}`);
    const json = await res.json();
    return parseEspnOdds(json);
  } catch (err) {
    console.error('getOdds error:', err);
    return null;
  }
}

// Batch variant (fetch several games concurrently)
export async function getOddsForEvents(
  eventIds: Array<string | number>
): Promise<Record<string, GameOdds | null>> {
  const entries = await Promise.allSettled(
    eventIds.map((id) => getOdds(id).then((odds) => [String(id), odds] as const))
  );
  const out: Record<string, GameOdds | null> = {};
  for (const r of entries) {
    if (r.status === 'fulfilled') {
      const [id, odds] = r.value;
      out[id] = odds;
    }
  }
  return out;
}
