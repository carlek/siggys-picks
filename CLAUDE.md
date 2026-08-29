# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Siggy's Picks: a Next.js app where "Siegfried the Cat" (Siggy) narrates NHL games — recaps and
previews written in his voice via Gemini — and produces a betting-style pick (moneyline lean +
underdog puckline) blended from bookmaker odds and team stats.

## Commands

```bash
npm run dev         # next dev --turbopack -p 9002 (note: non-default port)
npm run build        # next build
npm run start         # next start (serve built app)
npm run lint          # next lint
npm run typecheck     # tsc --noEmit
npm run genkit:dev    # genkit start -- tsx src/ai/dev.ts (Genkit dev UI/inspector)
npm run genkit:watch  # same, with --watch
```

There is no test runner configured in this repo (no test script, no test files) — don't assume
Jest/Vitest exist. `next.config.ts` sets `typescript.ignoreBuildErrors: true` and
`eslint.ignoreDuringBuilds: true`, so `next build` will succeed even with type/lint errors — run
`npm run typecheck` and `npm run lint` explicitly when you need those checks enforced.

## Architecture

### Data flow for a game day

1. `src/app/api/games/route.ts` → `getGames(date)` in `src/lib/nhl-games.ts` hits ESPN's public
   scoreboard endpoint (`site.api.espn.com/.../nhl/scoreboard?dates=YYYYMMDD`) to list that day's
   games.
2. For each event, `src/lib/nhl-espn-api.ts` (`getOddsAndStatsForEvents`) fetches the ESPN
   "summary" endpoint **once per event** and fans the single response out to two parsers:
   - `nhl-odds.ts` (`parseEspnOdds`) reads `pickcenter[0]` for moneylines/spreads/over-under.
   - `nhl-stats.ts` (`statsFromSummary`) pulls each team's abbreviation from the summary, then
     **scrapes** `espn.com/nhl/team/_/name/{abbr}` HTML with `cheerio` for GF/GA/PP%/PK% (the ESPN
     summary JSON doesn't carry season stat totals). This is the fragile part — ESPN's HTML
     structure (`#rankings__Module`, `.TeamStat__Item`) can change and silently stop matching.
   - Do not add a second independent summary fetch per event — always go through the shared
     `fetchEspnSummary` path in `nhl-espn-api.ts` so odds+stats stay one network round trip.
3. The client (`src/components/siggys-picks-app.tsx`) renders `Game` cards and calls
   `suggestSiggysPick()` from `src/lib/nhl-picks.ts` client-side to compute Siggy's pick from the
   `odds`/`stats` already embedded in each `Game`.
4. On demand (expanding a card), the client hits `src/app/api/summarize/route.ts`, which:
   - Resolves the article via `extractTextFromUrl` (`src/lib/text-extract.ts`) — this calls the
     ESPN summary API for the game (by parsing the `gameId` out of the recap/preview URL) and
     turns `article.story` HTML into plain paragraphs. It does **not** scrape the ESPN webpage
     directly (see recent commit history — this used to webscrape and was switched to the API).
   - Rewrites the extracted text in Siggy's voice via `summarizeAsSiggy` (`src/ai/genkit.ts`,
     Gemini 2.0 Flash through Genkit), selecting a `recap` or `preview` system prompt.
   - On a 429/rate-limit from Gemini, falls back to `summarizeWithoutAI` (naive extractive
     summary — first N sentences) and reports `siggyUnavailable: true` to the client so the UI can
     show a "Siggy's on a rate-limit nap" style message instead of a raw error.
5. `src/app/api/extract/route.ts` is a small standalone helper (title-only, via HTML regex) — it's
   not on the main summarize path.

### The pick model (`src/lib/nhl-picks.ts`)

Pure, synchronous, and fully described by `README.md`'s "Siggys Pick Configuration Guide" — read
that section before changing scoring behavior. In short: blend market-implied win probability
(devigged from moneylines) with a normalized stats-strength score via `marketWeight`, then apply a
small "underdog bump" when stats are close and the dog's price is juicy enough, and derive an
optional puckline (+1.5) recommendation from the resulting probabilities. All tunable knobs live in
`src/lib/nhl-picks.config.json` and are typed/defaulted/deep-merged in `nhl-picks.ts`
(`getConfig`/`mergeConfig`) — the UI can pass partial `overrides` at call time without touching the
JSON file.

### Siggy's voice (prompts)

`src/ai/getSystemPrompt.ts` picks between `recap`/`preview` system prompts. In production these
come from env vars (`SIGGY_RECAP_PROMPT`, `SIGGY_PREVIEW_PROMPT`) injected via Google Secret
Manager (see `firebase.json`'s `frameworksBackend.secrets`); locally, if those env vars are unset,
it reads `src/ai/prompts/siggy_{recap,preview}_prompt.txt` directly. When editing Siggy's persona,
edit the `.txt` files (and mirror the same edit into the Secret Manager values for prod) — the
`*_example.txt` files alongside them are just references, not loaded by code.

### Auth

Firebase Auth (Google sign-in) is client-only decoration via `useAuth()`
(`src/hooks/useAuth.ts`) / `AuthStrip` — there's no server-side session check gating the API
routes. `src/app/firebase.ts` initializes the Firebase app from `NEXT_PUBLIC_FIREBASE_*` env vars.

### Deployment

Firebase App Hosting, two backends/sites from one `firebase.json`: `siggys-picks` (prod) and
`siggys-picks-staging`. See `README.md` for the exact `firebase deploy` / `gcloud run` commands for
creating, destroying, and restoring IAM invoker permissions on the staging Cloud Run backend.
`apphosting.yaml` caps `maxInstances: 1`.

### Env vars

See `.env.local.example` for the full list (Gemini key, `NEXT_PUBLIC_FIREBASE_*`, Siggy prompt
overrides). Copy it to `.env.local` for local dev.
