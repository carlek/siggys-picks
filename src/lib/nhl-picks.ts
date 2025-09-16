export type Side = 'HOME' | 'AWAY';

export interface SiggysPick {
  moneylinePick: Side;
  moneylineConfidence: number; // 0..100
  winLean: Side;
  winConfidence: number;
  underdogPuckline?: { side: Side; line: number; confidence: number };
  rationale: string[];
}

/* -------------------- Config loading -------------------- */

// If you prefer YAML, install "yaml" and parse a .yaml file similarly.
// Here we use JSON with a safe default fallback.
import cfgJson from './nhl-picks.config.json';

type Bounds = { min: number; max: number };
interface PicksConfig {
  marketWeight: number;
  statsDefaults: {
    goalsForPerGame: number; goalsAgainstPerGame: number;
    powerPlayPct: number; penaltyKillPct: number;
  };
  statsBounds: {
    gfPerGame: Bounds; gaPerGame: Bounds; ppPct: Bounds; pkPct: Bounds;
  };
  statWeights: { gf: number; ga: number; pp: number; pk: number };
  siggy: {
    statsCloseThreshold: number; juicyUnderdogMinML: number; underdogBump: number;
  };
  puckline: {
    assumeStandardIfMissing: boolean; standardLine: number;
    dogViableMarketProbMax: number; minConfidence: number;
    extraConfIfStatsClose: number; confScale: number; dogTargetProb: number;
  };
}

const defaultConfig: PicksConfig = {
  marketWeight: 0.62,
  statsDefaults: { goalsForPerGame: 3.0, goalsAgainstPerGame: 3.0, powerPlayPct: 20.0, penaltyKillPct: 78.0 },
  statsBounds: {
    gfPerGame: { min: 2.2, max: 4.0 },
    gaPerGame: { min: 2.0, max: 4.0 },
    ppPct:     { min: 12.0, max: 30.0 },
    pkPct:     { min: 70.0, max: 88.0 }
  },
  statWeights: { gf: 0.38, ga: 0.32, pp: 0.18, pk: 0.12 },
  siggy: { statsCloseThreshold: 0.07, juicyUnderdogMinML: 150, underdogBump: 0.018 },
  puckline: {
    assumeStandardIfMissing: true,
    standardLine: 1.5,
    dogViableMarketProbMax: 0.45,
    minConfidence: 40,
    extraConfIfStatsClose: 0.03,
    confScale: 200,
    dogTargetProb: 0.55
  }
};

function loadConfig(): PicksConfig {
  try {
    return { ...defaultConfig, ...cfgJson } as PicksConfig;
  } catch {
    return defaultConfig;
  }
}

const CFG = loadConfig();

/* -------------------- Utils -------------------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function mlToProb(ml: number): number {
  return ml > 0 ? 100 / (ml + 100) : (-ml) / ((-ml) + 100);
}

export function devigTwoWay(pHome: number, pAway: number) {
  const k = pHome + pAway;
  if (k <= 0) return { pHome: 0.5, pAway: 0.5 };
  return { pHome: clamp01(pHome / k), pAway: clamp01(pAway / k) };
}

// stats and stat strength
type StatInput = {
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  powerPlayPct: number | null;
  penaltyKillPct: number | null;
};

function scale01(v: number, b: Bounds) {
  if (b.max === b.min) return 0.5;
  return clamp01((v - b.min) / (b.max - b.min));
}

function statStrength(s: StatInput): number {
  const d = CFG.statsDefaults;
  const b = CFG.statsBounds;
  const w = CFG.statWeights;

  const gf = s.goalsForPerGame ?? d.goalsForPerGame;
  const ga = s.goalsAgainstPerGame ?? d.goalsAgainstPerGame;
  const pp = s.powerPlayPct ?? d.powerPlayPct;
  const pk = s.penaltyKillPct ?? d.penaltyKillPct;

  const gf01 = scale01(gf, b.gfPerGame);
  const ga01 = 1 - scale01(ga, b.gaPerGame); // lower GA is better
  const pp01 = scale01(pp, b.ppPct);
  const pk01 = scale01(pk, b.pkPct);

  return clamp01(w.gf * gf01 + w.ga * ga01 + w.pp * pp01 + w.pk * pk01);
}

// suggestion for pick(s)
export function suggestSiggysPick(input: {
  home: { stats?: StatInput; moneyline?: number | null };
  away: { stats?: StatInput; moneyline?: number | null };
  homePointSpread?: number | null;
  awayPointSpread?: number | null;
}): SiggysPick {
  const rationale: string[] = [];

  // market probs
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

  // stat strength
  const sHome = statStrength(input.home.stats ?? ({} as any));
  const sAway = statStrength(input.away.stats ?? ({} as any));
  rationale.push(`Stats strength Home ${Math.round(sHome*100)}%, Away ${Math.round(sAway*100)}%.`);

  // blend and clamp
  const wOdds = CFG.marketWeight;
  const pHomeStatsSide = (sHome + sAway) > 0 ? sHome / (sHome + sAway) : 0.5;
  let pHome = clamp01(wOdds * pHomeMkt + (1 - wOdds) * pHomeStatsSide);
  let pAway = clamp01(1 - pHome);

  // Siggy underdog bump
  const homeIsDog = hasML && input.home.moneyline! > input.away.moneyline!;
  const awayIsDog = hasML && input.away.moneyline! > input.home.moneyline!;
  const statsClose = Math.abs(sHome - sAway) <= CFG.siggy.statsCloseThreshold;

  const dogIsJuicy = (ml?: number | null) => ml != null && ml >= CFG.siggy.juicyUnderdogMinML;

  if (statsClose && hasML) {
    if (homeIsDog && dogIsJuicy(input.home.moneyline)) {
      pHome += CFG.siggy.underdogBump; pAway -= CFG.siggy.underdogBump;
      rationale.push('Siggy bump: home dog close on stats.');
    } else if (awayIsDog && dogIsJuicy(input.away.moneyline)) {
      pAway += CFG.siggy.underdogBump; pHome -= CFG.siggy.underdogBump;
      rationale.push('Siggy bump: away dog close on stats.');
    }
    pHome = clamp01(pHome); pAway = clamp01(pAway);
  }

  // Moneyline pick
  const moneylinePick: Side = pHome >= pAway ? 'HOME' : 'AWAY';
  const moneylineConfidence = Math.round(100 * Math.abs(pHome - pAway));
  rationale.push(`ML lean: ${moneylinePick} (conf ${moneylineConfidence}).`);

  // Puckline (dog +1.5)
  const PL = CFG.puckline;
  const stdLine = PL.standardLine;
  const assumeStd = PL.assumeStandardIfMissing;

  const homePL = input.homePointSpread ?? (assumeStd && hasML ? (homeIsDog ? +stdLine : -stdLine) : null);
  const awayPL = input.awayPointSpread ?? (assumeStd && hasML ? (awayIsDog ? +stdLine : -stdLine) : null);

  let underdogPuckline: SiggysPick['underdogPuckline'] = undefined;

  if (hasML) {
    if (homeIsDog && (homePL === +stdLine || homePL == null)) {
      if (pHomeMkt <= PL.dogViableMarketProbMax || statsClose) {
        const conf = Math.min(
          100,
          Math.round((PL.dogTargetProb - pHomeMkt + (statsClose ? PL.extraConfIfStatsClose : 0)) * PL.confScale)
        );
        underdogPuckline = { side: 'HOME', line: +stdLine, confidence: Math.max(PL.minConfidence, conf) };
        rationale.push('Siggy likes a home dog +1.5.');
      }
    } else if (awayIsDog && (awayPL === +stdLine || awayPL == null)) {
      if (pAwayMkt <= PL.dogViableMarketProbMax || statsClose) {
        const conf = Math.min(
          100,
          Math.round((PL.dogTargetProb - pAwayMkt + (statsClose ? PL.extraConfIfStatsClose : 0)) * PL.confScale)
        );
        underdogPuckline = { side: 'AWAY', line: +stdLine, confidence: Math.max(PL.minConfidence, conf) };
        rationale.push('Siggy likes an away dog +1.5.');
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
