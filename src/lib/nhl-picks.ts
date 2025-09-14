export type Side = 'HOME' | 'AWAY';

export interface SiggysPick {
  moneylinePick: Side;
  moneylineConfidence: number; // 0..100
  winLean: Side;               // same as ML, but kept separate (might diverge later)
  winConfidence: number;       // 0..100 (mirrors ML for now)

  underdogPuckline?: {
    side: Side;                // underdog side
    line: number;              // usually +1.5
    confidence: number;        // 0..100
  };

  rationale: string[];
}

// clamp function
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Convert American odds to implied probability (with vig).
export function mlToProb(ml: number): number {
  return ml > 0 ? 100 / (ml + 100) : (-ml) / ((-ml) + 100);
}

// Two-way de-vig approximation. 
export function devigTwoWay(pHome: number, pAway: number) {
  const k = pHome + pAway;
  if (k <= 0) return { pHome: 0.5, pAway: 0.5 };
  return { pHome: clamp01(pHome / k), pAway: clamp01(pAway / k) };
}

// Normalize basic team stats into ~[0,1] and blend. 
function statStrength(s: {
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  powerPlayPct: number | null;
  penaltyKillPct: number | null;
}): number {
  // Defaults 
  const gf = s.goalsForPerGame ?? 3.0;  // league-ish baseline
  const ga = s.goalsAgainstPerGame ?? 3.0;
  const pp = s.powerPlayPct ?? 20.0;    // %
  const pk = s.penaltyKillPct ?? 78.0;  // %

  // Scale to ~0..1 ranges (simple & robust)
  const gf01 = clamp01((gf - 2.2) / (4.0 - 2.2));        // GF/G ~ 2.2..4.0
  const ga01 = 1 - clamp01((ga - 2.0) / (4.0 - 2.0));    // lower GA is better
  const pp01 = clamp01((pp - 12) / (30 - 12));           // PP% ~ 12..30
  const pk01 = clamp01((pk - 70) / (88 - 70));           // PK% ~ 70..88

  // tweak to taste
  return clamp01(0.38 * gf01 + 0.32 * ga01 + 0.18 * pp01 + 0.12 * pk01);
}

// Derive Siggys PIck 
export function suggestSiggysPick(input: {
  home: {
    stats?: {
      goalsForPerGame: number | null;
      goalsAgainstPerGame: number | null;
      powerPlayPct: number | null;
      penaltyKillPct: number | null;
    };
    moneyline?: number | null;
  };
  away: {
    stats?: {
      goalsForPerGame: number | null;
      goalsAgainstPerGame: number | null;
      powerPlayPct: number | null;
      penaltyKillPct: number | null;
    };
    moneyline?: number | null;
  };
  // Optional puckline points if parsed else assume ±1.5
  homePointSpread?: number | null;
  awayPointSpread?: number | null;
}): SiggysPick {
  const rationale: string[] = [];

  // Market probabilities (de-vigged) 
  let pHomeMkt = 0.5, pAwayMkt = 0.5;
  const hasML = input.home.moneyline != null && input.away.moneyline != null;

  if (hasML) {
    const ph = mlToProb(input.home.moneyline!);
    const pa = mlToProb(input.away.moneyline!);
    const dv = devigTwoWay(ph, pa);
    pHomeMkt = dv.pHome; pAwayMkt = dv.pAway;
    rationale.push(`Market says Home ${Math.round(pHomeMkt*100)}%, Away ${Math.round(pAwayMkt*100)}%.`);
  } else {
    rationale.push('Moneylines missing; falling back to stats only.');
  }

  // Stats strengths
  const sHome = statStrength(input.home.stats ?? ({} as any));
  const sAway = statStrength(input.away.stats ?? ({} as any));
  rationale.push(`Stats strength Home ${Math.round(sHome*100)}%, Away ${Math.round(sAway*100)}%.`);

  // Blend market & stats. Weight market a bit more (tunable).
  const wOdds = 0.62;
  
  // turn stats into a side probability
  const pHomeStatsSide = (sHome + sAway) > 0 ? sHome / (sHome + sAway) : 0.5;
  let pHome = clamp01(wOdds * pHomeMkt + (1 - wOdds) * pHomeStatsSide);
  let pAway = clamp01(1 - pHome);

  // Siggy underdog bump (if stats are close and dog is "juicy") ---
  const homeIsDog = hasML && input.home.moneyline! > input.away.moneyline!;
  const awayIsDog = hasML && input.away.moneyline! > input.home.moneyline!;
  const statsClose = Math.abs(sHome - sAway) <= 0.07; // within ~7%

  const dogIsJuicy = (ml: number | null | undefined) => ml != null && ml >= 150;

  if (statsClose && hasML) {
    if (homeIsDog && dogIsJuicy(input.home.moneyline)) {
      
      pHome += 0.018; pAway -= 0.018; rationale.push('Siggy bump: home dog close on stats.');
    } else if (awayIsDog && dogIsJuicy(input.away.moneyline)) {
      pAway += 0.018; pHome -= 0.018; rationale.push('Siggy bump: away dog close on stats.');
    }
    pHome = clamp01(pHome); pAway = clamp01(pAway);
  }

  // Moneyline pick (right now, simple win/lose lean) ---
  const moneylinePick: Side = pHome >= pAway ? 'HOME' : 'AWAY';
  const moneylineConfidence = Math.round(100 * Math.abs(pHome - pAway));
  rationale.push(`ML lean: ${moneylinePick} (conf ${moneylineConfidence}).`);

  // Use supplied +1.5 if present, else assume standard puckline ±1.5.
  const homePL = input.homePointSpread ?? (hasML ? (homeIsDog ? +1.5 : -1.5) : null);
  const awayPL = input.awayPointSpread ?? (hasML ? (awayIsDog ? +1.5 : -1.5) : null);

  let underdogPuckline: SiggysPick['underdogPuckline'] = undefined;

  if (hasML) {
    if (homeIsDog && (homePL === +1.5 || homePL == null)) {
      // heuristics: if market has home <= 45% or statsClose, +1.5 looks viable
      if (pHomeMkt <= 0.45 || statsClose) {
        const conf = Math.min(100, Math.round((0.55 - pHomeMkt + (statsClose ? 0.03 : 0)) * 200));
        underdogPuckline = { side: 'HOME', line: +1.5, confidence: Math.max(40, conf) };
        rationale.push('Siggy likes the home dog +1.5.');
      }
    } else if (awayIsDog && (awayPL === +1.5 || awayPL == null)) {
      if (pAwayMkt <= 0.45 || statsClose) {
        const conf = Math.min(100, Math.round((0.55 - pAwayMkt + (statsClose ? 0.03 : 0)) * 200));
        underdogPuckline = { side: 'AWAY', line: +1.5, confidence: Math.max(40, conf) };
        rationale.push('Siggy likes the away dog +1.5.');
      }
    }
  }

  return {
    moneylinePick,
    moneylineConfidence,
    winLean: moneylinePick,
    winConfidence: moneylineConfidence,
    underdogPuckline,
    rationale,
  };
}
