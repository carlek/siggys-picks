"use client"

import * as React from "react"
import { format, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"

import { getGames, type Game } from "@/lib/nhl-games"
import { suggestSiggysPick } from "@/lib/nhl-picks"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { HockeyPuckIcon, HockeyRinkIcon } from "@/components/icons"
import { useAuth } from "@/hooks/useAuth";
import { AuthStrip } from "@/components/auth/AuthStrip";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react";
import { firebaseConfig } from "@/app/firebase";


function GameCard({ game }: { game: Game }) {
  const { user, loading: authLoading } = useAuth();

  const [flipped, setFlipped] = React.useState(false)
  const [recapTitle, setRecapTitle] = React.useState<string | null>(null)
  const [recapLoading, setRecapLoading] = React.useState(false)
  const noRecapCopy = "😿 Sorry, this game summary is lost under a couch. -Siggy- 🐈‍⬛";

  // Stats dialog
  const [statsOpen, setStatsOpen] = React.useState(false)
  const fmt = (n: number | null | undefined, opts?: { pct?: boolean }) => {
    if (n == null || Number.isNaN(n)) return "—"
    return opts?.pct ? `${n.toFixed(1)}%` : n.toFixed(2)
  }

  // Summary toggle
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  const [summaryLoading, setSummaryLoading] = React.useState(false)
  const [summaryText, setSummaryText] = React.useState<string | null>(null)
  const [summaryError, setSummaryError] = React.useState<string | null>(null)
  
  // Typing effect
  const [typed, setTyped] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [typedOnce, setTypedOnce] = React.useState(false);

  const TeamDisplay = ({ team }: { team: Game["homeTeam"] }) => (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-primary-foreground border-2 border-background shadow-inner"
        style={{ backgroundColor: team.logoColor }}
      >
        {team.name.charAt(0)}
      </div>
      <div className="flex flex-col">
        <span className="font-semibold font-headline text-lg leading-tight">{team.city}</span>
        <span className="font-semibold font-headline text-lg leading-tight">{team.name}</span>
      </div>
    </div>
  )

  // Pull headline via lightweight title route for FINAL games
  React.useEffect(() => {
    let abort = false
    async function loadTitle() {
      if (game.status !== "FINAL" || !game.recapUrl) {
        setRecapTitle(null)
        return
      }
      try {
        setRecapLoading(true)
        const res = await fetch(`/api/recap?url=${encodeURIComponent(game.recapUrl)}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`recap ${res.status}`)
        const data = await res.json()
        if (!abort) setRecapTitle(typeof data?.title === "string" ? data.title : null)
      } catch {
        if (!abort) setRecapTitle(null)
      } finally {
        if (!abort) setRecapLoading(false)
      }
    }
    loadTitle()
    return () => { abort = true }
  }, [game.status, game.recapUrl])

  // Write with typewriter effect
  React.useEffect(() => {
    // bail out if we've already typed once
    if (typedOnce) {
      setTyping(false);
      setTyped(summaryText || "");
      return;
    }

    if (!summaryOpen || summaryLoading || summaryError || !summaryText) {
      setTyping(false);
      setTyped("");
      return;
    }

    // Respect reduced motion
    if (typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyping(false);
      setTyped(summaryText);
      setTypedOnce(true); // mark it done
      return;
    }

    let i = 0;
    let cancelled = false;
    setTyping(true);
    setTyped("");

    const base = 25;
    const punctExtra = 400;

    const tick = () => {
      if (cancelled) return;
      i = Math.min(i + 1, summaryText.length);
      setTyped(summaryText.slice(0, i));

      if (i >= summaryText.length) {
        setTyping(false);
        setTypedOnce(true); 
        return;
      }

      const prevChar = summaryText[i - 1];
      const extra = /[.!?;]/.test(prevChar) ? punctExtra : 0;
      const delay = base + extra;

      timeout = window.setTimeout(tick, delay);
    };

    let timeout = window.setTimeout(tick, base);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [summaryOpen, summaryLoading, summaryError, summaryText, typedOnce]);

  // Back face text logic
  const backText = React.useMemo(() => {
    const home = game.homeTeam.name
    const away = game.awayTeam.name
    if (game.status === "FINAL") {
      if (recapTitle && recapTitle.trim().length > 0)
        return recapTitle
      // Fall back
      const homeWon = (game.homeScore ?? 0) >= (game.awayScore ?? 0)
      const winner = homeWon ? home : away
      const loser = homeWon ? away : home
      const x = homeWon ? (game.homeScore ?? 0) : (game.awayScore ?? 0)
      const y = homeWon ? (game.awayScore ?? 0) : (game.homeScore ?? 0)
      return `${winner} beat ${loser} with a score of ${x}-${y}`
    }
    if (game.status === "SCHEDULED") {
      return `${home} are hosting ${away} at ${game.gameTime} ET`
    }
    return `${away} vs ${home}`
  }, [game, recapTitle])

  const toggle = () => setFlipped(v => !v)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggle()
    }
  }

  // Fetch summary on demand
  const onToggleSummary: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.stopPropagation()

    if (!summaryOpen) {
      // Open the panel immediately so the loading message can render
      setSummaryOpen(true)

      if (game.status === "FINAL" && game.recapUrl && !summaryText && !summaryLoading) {
        try {
          setSummaryError(null)
          setSummaryLoading(true)

          const query = new URLSearchParams({ url: game.recapUrl })
          const r = await fetch(`/api/summarize?${query.toString()}`, { cache: "no-store" })

          if (!r.ok) throw new Error(`summarize ${r.status}`)
          const data = await r.json()
          setSummaryText(typeof data?.summary === "string" ? data.summary : null)
        } catch (err: any) {
          setSummaryError(err?.message || "Failed to load summary")
        } finally {
          setSummaryLoading(false)
        }
      }
    } else {
      setSummaryOpen(false)
    }
  }

  // derive Siggys pick
  const siggysPick = React.useMemo(() => {
    return suggestSiggysPick({
      home: {
        stats: game.stats?.home,
        moneyline: game.odds?.home.moneyline ?? null,
      },
      away: {
        stats: game.stats?.away,
        moneyline: game.odds?.away.moneyline ?? null,
      },
      homePointSpread: game.odds?.home.pointSpread ?? null,
      awayPointSpread: game.odds?.away.pointSpread ?? null,
    });
  }, [game.stats, game.odds, game.homeTeam, game.awayTeam]);

  const pickTeamName =
    siggysPick.moneylinePick === "HOME"
      ? `${game.homeTeam.city} ${game.homeTeam.name}`
      : `${game.awayTeam.city} ${game.awayTeam.name}`;

  const pucklineBlurb = siggysPick.underdogPuckline
    ? ` • +${Math.abs(siggysPick.underdogPuckline.line)} on the ${
        siggysPick.underdogPuckline.side === "HOME"
          ? `${game.homeTeam.name}`
          : `${game.awayTeam.name}`
      } (${siggysPick.underdogPuckline.confidence}% conf)`
    : "";

  const siggyOneLiner = `I'll take ${pickTeamName} ML (${siggysPick.moneylineConfidence}%).${pucklineBlurb} — meow.`;

  const fmtOdds = (n: number | null | undefined) =>
    n == null ? 'Ⓧ' : (n > 0 ? `+${n}` : `${n}`);

  return (
    <Card
      className="hover:shadow-lg hover:border-accent transition-all duration-300"
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={toggle}
      onKeyDown={onKey}
    >
      <CardContent className="p-4">
        <div className="relative h-56 [perspective:1000px]">
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]",
              flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
            )}
          >
            {/* Front Face */}
            <div className="absolute inset-0 [backface-visibility:hidden]">

              <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                <span>{game.status === "FINAL" ? "FINAL" : game.gameTime}</span>
                <button
                  type="button"
                  aria-label="View team stats"
                  className="rounded-md p-1 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={(e) => { e.stopPropagation(); setStatsOpen(true); }}
                >
                  <HockeyRinkIcon className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                {/* Away team + odds */}
                <div className="flex flex-col items-center">
                  <TeamDisplay team={game.awayTeam} />
                  <div className="text-[11px] mt-1">
                    {fmtOdds(game.odds?.away.moneyline)} / {fmtOdds(game.odds?.away.pointSpread)}
                    ({fmtOdds(game.odds?.away.spreadOdds)})
                  </div>
                </div>

                {/* Score/VS + centered O/U */}
                <div className="flex flex-col items-center justify-center">
                  {game.status !== "SCHEDULED" ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold font-headline">{game.awayScore}</span>
                      <span className="text-xl text-bold font-headline">-</span>
                      <span className="text-4xl font-bold font-headline">{game.homeScore}</span>
                    </div>
                  ) : (
                    <div className="text-lg font-semibold font-headline text-muted-foreground">VS</div>
                  )}
                    <div className="mt-1 text-[11px]">o
                      {game.odds?.overUnder} ({fmtOdds(game.odds?.overOdds)})</div>
                  </div>

                {/* Home team + odds */}
                <div className="flex flex-col items-center">
                  <TeamDisplay team={game.homeTeam} />
                  <div className="text-[11px] mt-1">
                    {fmtOdds(game.odds?.home.moneyline)} / {fmtOdds(game.odds?.home.pointSpread)}
                    ({fmtOdds(game.odds?.home.spreadOdds)})
                  </div>
                </div>
              </div>
            </div>

            {/* Back face */}
            <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
              <div
                className={cn(
                  "h-full w-full rounded-md border bg-muted/30 flex flex-col p-4",
                  summaryOpen ? "items-start justify-start" : "items-center justify-center",
                  "min-h-0" // allow scrollable children to size correctly
                )}
              >
                {/* Title / headline shown only when summary is closed */}
                {!summaryOpen && (
                  <div className="text-xl font-headline font-semibold leading-snug px-2 w-full text-center">
                    {recapLoading ? "Loading recap..." : backText}
                  </div>
                )}

                {/* Animated, scrollable summary */}
                {game.status === "FINAL" && (
                  <div
                    id="recap-summary"
                    className={cn(
                      "w-full mt-2 px-2 grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                      summaryOpen ? "opacity-100 [grid-template-rows:1fr]" : "opacity-0 [grid-template-rows:0fr]",
                      "min-h-0" // crucial for nested scroller
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Single grid row that grows/shrinks */}
                    <div className="min-h-0 overflow-hidden">
                      {/* The actual scroll container */}
                      <div className="h-full max-h-56 md:max-h-72 overflow-y-auto overscroll-contain pr-3 pl-2 text-left">
                        <div
                          className="text-xs font-semibold text-muted-foreground leading-relaxed whitespace-pre-wrap break-words transition-opacity"
                          aria-live="polite"
                        >

                          {summaryLoading ? (
                            "\"Hang on, I'm digging up that game.\" -Siggy- 🐈‍⬛"
                          ) : (
                            <>
                              {typing ? typed : (summaryText ?? "")}
                              {typing && (
                                <span className="ml-1 inline-block w-[2px] h-4 align-baseline bg-foreground animate-pulse" />
                              )}
                            </>
                          )}

                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {game.status === "FINAL" && (
                  <div className="mt-3 w-full flex justify-center">
                    {game.recapUrl ? (
                      <button
                        className="flex items-center justify-center text-xs px-3 py-1 rounded-full border bg-background hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleSummary(e)
                        }}
                        aria-expanded={summaryOpen}
                        aria-controls="recap-summary"
                        disabled={summaryLoading}
                      >
                        {summaryLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-300",
                              summaryOpen && "rotate-180"
                            )}
                          />
                        )}
                      </button>
                    ) : (
                      <div className="text-xs font-semibold text-muted-foreground text-center px-3">
                        {noRecapCopy}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>

        {/* Stats and Pick dialog */}
        <Dialog open={statsOpen} onOpenChange={(v) => setStatsOpen(v)}>
          <DialogContent
            className="max-w-md sm:max-w-lg"
            aria-describedby={undefined}         // prevents radix dialog warning
            onClick={(e) => e.stopPropagation()} // prevent closing/flip on inner clicks
          >
            <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className="max-w-md sm:max-w-lg rounded-xl border bg-card shadow-2xl"
              >

                <DialogHeader>
                  <DialogTitle className="font-headline text-center text-base">
                    Siggys Pick & Stats - {game.awayTeam.city} @ {game.homeTeam.city}
                  </DialogTitle>
                </DialogHeader>

                {/* --- Siggy's pick callout --- */}
                <div className="mt-3 rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Siggy’s Pick</div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {siggysPick.moneylineConfidence}% / {siggysPick.underdogPuckline?.confidence}%
                    </div>
                  </div>

                  <div className="mt-1 text-sm">
                    ML:&nbsp;
                    <span className="font-semibold">
                      {siggysPick.moneylinePick === "HOME" ? game.homeTeam.name : game.awayTeam.name}
                    </span>
                    &nbsp;({siggysPick.moneylinePick === "HOME" ? fmtOdds(game.odds?.home.moneyline) : fmtOdds(game.odds?.away.moneyline)})
                    {siggysPick.underdogPuckline && (
                      <>
                        <span className="mx-2 text-bold">•</span>
                        <span>
                          Dog:&nbsp;
                          <span className="font-semibold">
                            {siggysPick.underdogPuckline.side === "HOME" ? game.homeTeam.name : game.awayTeam.name}
                          </span>
                          &nbsp;({siggysPick.underdogPuckline.side === "HOME" ?
                              fmtOdds(game.odds?.home.pointSpread)
                            : fmtOdds(game.odds?.away.pointSpread)}
                            &nbsp;/&nbsp;
                            {siggysPick.underdogPuckline.side === "HOME" ?
                              fmtOdds(game.odds?.home.spreadOdds)
                            : fmtOdds(game.odds?.away.spreadOdds)})
                        </span>
                      </>
                    )}
                  </div>

                  {/* Siggy one-liner */}
                  <p className="mt-1 text-xs text-bold italic">
                    {siggyOneLiner}
                  </p>

                  {/* Rationale (collapsible) */}
                  <Accordion type="single" collapsible className="mt-1">
                    <AccordionItem value="why">
                      <AccordionTrigger className="text-xs">Why this pick?</AccordionTrigger>
                      <AccordionContent>
                        {siggysPick.rationale?.length ? (
                          <ul className="list-disc pl-5 space-y-1 text-xs text-bole">
                            {siggysPick.rationale.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No rationale available.</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>



                <div className="mt-2 border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1.2fr,1fr,1fr] text-xs">
                    {/* Header row */}
                    <div className="bg-muted/60 px-3 py-2 font-semibold">Metric</div>
                    <div className="bg-muted/60 px-3 py-2 font-semibold text-center">
                      {game.awayTeam.name}
                    </div>
                    <div className="bg-muted/60 px-3 py-2 font-semibold text-center">
                      {game.homeTeam.name}
                    </div>

                    {/* GF/G */}
                    <div className="px-3 py-2">GF / Game</div>
                    <div className="px-3 py-2 text-center">{fmt(game.stats?.away.goalsForPerGame)}</div>
                    <div className="px-3 py-2 text-center">{fmt(game.stats?.home.goalsForPerGame)}</div>

                    {/* GA/G */}
                    <div className="px-3 py-2 bg-muted/20">GA / Game</div>
                    <div className="px-3 py-2 text-center bg-muted/20">{fmt(game.stats?.away.goalsAgainstPerGame)}</div>
                    <div className="px-3 py-2 text-center bg-muted/20">{fmt(game.stats?.home.goalsAgainstPerGame)}</div>

                    {/* PP% */}
                    <div className="px-3 py-2">PP %</div>
                    <div className="px-3 py-2 text-center">{fmt(game.stats?.away.powerPlayPct, { pct: true })}</div>
                    <div className="px-3 py-2 text-center">{fmt(game.stats?.home.powerPlayPct, { pct: true })}</div>

                    {/* PK% */}
                    <div className="px-3 py-2 bg-muted/20">PK %</div>
                    <div className="px-3 py-2 text-center bg-muted/20">{fmt(game.stats?.away.penaltyKillPct, { pct: true })}</div>
                    <div className="px-3 py-2 text-center bg-muted/20">{fmt(game.stats?.home.penaltyKillPct, { pct: true })}</div>
                  </div>
                </div>

                {/* footer notice */}
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Live values from ESPN may update periodically.
                </p>
            </motion.div>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  )
}

export function SiggysPicksApp() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date())
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(new Date())
  const [games, setGames] = React.useState<Game[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()

  React.useEffect(() => {
    if (!selectedDate) return

    // Wait until authLoading is over and a user is present
    if (authLoading) return
    if (!user) {
      setIsLoading(false)
      setGames([])
      return
    }

    setIsLoading(true)
    getGames(selectedDate)
      .then(fetchedGames => setGames(fetchedGames))
      .catch(err => {
        console.error("Error fetching games:", err)
        toast({
          title: "Error Fetching Games",
          description: `Could not fetch game data: ${err.message}. Check the console for more details.`,
          variant: "destructive",
        })
      })
      .finally(() => setIsLoading(false))
  }, [selectedDate, user, authLoading, toast])

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return
    setSelectedDate(date)
    setDisplayedMonth(date)
    setIsPopoverOpen(false)
  }

  const calendar = (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={handleDateSelect}
      month={displayedMonth}
      onMonthChange={setDisplayedMonth}
      className="rounded-md"
      footer={
        <Button
          variant="ghost"
          className="w-full mt-2"
          onClick={() => handleDateSelect(new Date())}
          disabled={!!selectedDate && isSameDay(selectedDate, new Date())}
        >
          Go to Today
        </Button>
      }
    />
  )

  return (
    <div className="flex h-full bg-card">
      <aside className="w-[340px] hidden md:flex flex-col border-r bg-muted/30 p-4">
        <div className="flex items-center gap-3 mb-6 px-2">
          <HockeyPuckIcon className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold font-headline text-foreground">Siggys Picks</h1>
          <HockeyRinkIcon className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1">{calendar}</div>
        <div className="text-xs text-muted-foreground p-2">
          <p>Select a date to view past scores and upcoming games.</p>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">

        <header className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <HockeyPuckIcon className="w-8 h-8 text-primary shrink-0 md:hidden" />
            <HockeyRinkIcon className="w-8 h-8 text-primary shrink-0 md:hidden" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold font-headline text-foreground md:hidden">Siggys Picks</h1>
              <h2 className="text-xl md:text-2xl font-semibold font-headline text-foreground">
                {selectedDate ? `Games on ${format(selectedDate, "EEEE MMMM d")}` : "Select a date"}
              </h2>
            </div>
          </div>

          {/* calendar + Auth */}
          <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:gap-3">
            {/* mobile date picker */}
            <div className="md:hidden">
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full md:w-auto justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "P") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  {calendar}
                </PopoverContent>
              </Popover>
            </div>

            <div className="shrink-0">
              <AuthStrip />
            </div>
          </div>

        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background/60">
          {authLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground rounded-lg border-2 border-dashed p-8">
              <h3 className="text-lg font-semibold font-headline mb-1 text-foreground">
                🐈‍⬛ Please sign in 🐈‍⬛ 
              </h3>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : games.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {games.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground rounded-lg border-2 border-dashed p-8">
              <CalendarIcon className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-semibold font-headline mb-1 text-foreground">No Games Scheduled</h3>
              <p>There are no games on this date.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
