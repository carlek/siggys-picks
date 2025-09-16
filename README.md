# siggys-picks

Siegfried the Cat is a big NHL fan.

He summarizes games in his special style, always looking out for his beloved Panthers..... and poking fun at the Leafs.

He also give picks based on team stats and book maker odds, and has a soft spot for the underdog.

Stay tuned for game previews, and more wisdom and fun from Siggy the Sigster.
 
![Demo](./siggys-picks.webp)


<summary><strong>Siggys Pick Configuration Guide</strong></summary>

Documentation on configuration values and how it shapes Siggy's picks:

**market (books) + stats (GF/GA/PP/PK) + catnip**
_=> pick + confidence._

---

### Top-level blend

#### `marketWeight` (e.g., `0.62`)

* **What it is:** How much we trust bookmakers vs. our stat model.
* **How it works:** Final home win prob = `marketWeight * marketProb + (1 - marketWeight) * statsProb`.
* **Tune it:**

  * **More conservative / book-leaning:** raise to `0.7-0.8` (fewer contrarian calls).
  * **More opinionated / stats-leaning:** lower to `0.5` (more swings vs. the line).

---

### Stat model inputs

#### `statsDefaults`

```json
{ "goalsForPerGame": 3.0, "goalsAgainstPerGame": 3.0, "powerPlayPct": 20.0, "penaltyKillPct": 78.0 }
```

* **What it is:** Fallback values when a stat is missing.
* **Why:** Keeps the model stable if scraping misses a number.
* **Tune it:** Update to the current league baselines if the season's scoring environment shifts.

#### `statsBounds`

```json
{
  "gfPerGame": { "min": 2.2, "max": 4.0 },
  "gaPerGame": { "min": 2.0, "max": 4.0 },
  "ppPct":     { "min": 12.0, "max": 30.0 },
  "pkPct":     { "min": 70.0, "max": 88.0 }
}
```

* **What it is:** The expected range to scale each stat into **0..1**.
* **How it works:** Values below `min` clamp to 0, above `max` clamp to 1.
* **Tune it:** If the league gets higher scoring (or special-teams swing), widen/shift these so scaling stays fair.

#### `statWeights`

```json
{ "gf": 0.38, "ga": 0.32, "pp": 0.18, "pk": 0.12 }
```

* **What it is:** How much each stat contributes to the **stats strength** score.
* **How it works:** `strength = gf*w.gf + (1 - gaScaled)*w.ga + pp*w.pp + pk*w.pk`.
* **Tune it:**

  * Emphasize **defense/goal suppression** → raise `ga`.
  * Emphasize raw **firepower** → raise `gf`.
  * If you think special teams are decisive that week, bump `pp`/`pk`.

---

### Siggy's underdog spice

#### `siggy.statsCloseThreshold` (e.g., `0.07`)

* **What it is:** How close the two teams' **stat strengths** must be to trigger the "live dog" lens.
* **Lower** = stricter definition of "close" (fewer dog bumps).
* **Higher** = more dogs considered "close."

#### `siggy.juicyUnderdogMinML` (e.g., `150`)

* **What it is:** Minimum underdog moneyline for "juicy" status (e.g., +150 or longer).
* **Raise** to make Siggy pick only clearly priced dogs (e.g., `+170`).
* **Lower** to include milder dogs (e.g., `+130`).

#### `siggy.underdogBump` (e.g., `0.018`)

* **What it is:** The **probability nudge** added to the dog when stats are close and price is juicy.
* **Effect:** Small but meaningful sway toward the underdog on the ML decision.
* **Tune it:** `0.015-0.025` is a sensible band.

---

### Puckline policy (dog +1.5)

#### `puckline.assumeStandardIfMissing` (true/false) & `puckline.standardLine` (e.g., `1.5`)

* **What it is:** If we don't have book spreads, assume the usual **±1.5**.
* **Turn off** if you only want to suggest +1.5 when the API provides it.

#### `puckline.dogViableMarketProbMax` (e.g., `0.45`)

* **What it is:** If the dog's market win prob ≤ this, +1.5 is considered.
* **Lower** (e.g., `0.42`) to be pickier; **higher** to show +1.5 more often.

#### `puckline.minConfidence` (e.g., `40`)

* **What it is:** Floor for the +1.5 confidence value (avoid tiny/confusing confidences).

#### `puckline.extraConfIfStatsClose` (e.g., `0.03`)

* **What it is:** Bonus confidence when **stats are close** (synergy with Siggy's philosophy).

#### `puckline.confScale` (e.g., `200`) & `puckline.dogTargetProb` (e.g., `0.55`)

* **How confidence is computed:**
  `confidence ≈ (dogTargetProb - dogMarketProb [+ extraIfClose]) * confScale`, then clamped to 0..100 and floored by `minConfidence`.
* **Tune it:**

  * Want **bigger confidence numbers**? Raise `confScale` (e.g., `220-260`).
  * Want +1.5 recommended only when the market is really underrating the dog? Raise `dogTargetProb` a bit.

---

### How it all plays together

1. **Market vs Stats:** We blend bookmaker probability with normalized stat model via `marketWeight`.
2. **Siggy Bump:** If the dog is **juicy** and the teams look **close on stats**, we nudge the dog probability a hair.
3. **Picks:**

   * **Moneyline pick** = side with higher blended probability; **confidence** scales with the gap.
   * **Underdog +1.5** = offered when the dog is reasonably live by market and/or stats then confidence is computed against a target.

---

### Quick presets

* **Play it safe (book-heavy):**

  ```json
  { "marketWeight": 0.72, "siggy": { "statsCloseThreshold": 0.06, "juicyUnderdogMinML": 160, "underdogBump": 0.015 } }
  ```

* **Bolder / dog-friendly:**

  ```json
  { "marketWeight": 0.55, "siggy": { "statsCloseThreshold": 0.09, "juicyUnderdogMinML": 140, "underdogBump": 0.022 },
    "puckline": { "dogViableMarketProbMax": 0.47, "minConfidence": 45 } }
  ```

* **Special-teams emphasis:**

  ```json
  { "statWeights": { "gf": 0.33, "ga": 0.27, "pp": 0.24, "pk": 0.16 } }
  ```
</details>