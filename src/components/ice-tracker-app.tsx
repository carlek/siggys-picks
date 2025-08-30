"use client"

import * as React from "react"
import { format, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"

import { getGames, type Game } from "@/lib/nhl-api"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { HockeyPuckIcon } from "@/components/icons"
import { useAuth } from "@/hooks/useAuth";
import { AuthStrip } from "@/components/auth/AuthStrip";

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
        <span className="font-body text-base text-muted-foreground leading-tight">{team.name}</span>
      </div>
    </div>
  )

  // Pull headline via your lightweight title route for FINAL games
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
                <HockeyPuckIcon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                <TeamDisplay team={game.awayTeam} />
                {game.status !== "SCHEDULED" ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-bold font-headline">{game.awayScore}</span>
                    <span className="text-xl text-muted-foreground">-</span>
                    <span className="text-4xl font-bold font-headline">{game.homeScore}</span>
                  </div>
                ) : (
                  <div className="text-lg font-semibold font-headline text-muted-foreground">VS</div>
                )}
                <TeamDisplay team={game.homeTeam} />
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
      </CardContent>
    </Card>
  )
}

export function IceTrackerApp() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date())
  const [displayedMonth, setDisplayedMonth] = React.useState<Date>(new Date())
  const [games, setGames] = React.useState<Game[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()

  React.useEffect(() => {
    if (!selectedDate) return

    // If auth is enabled, wait until authLoading is false and the user is present
    if (firebaseConfig.enableAuth) {
      if (authLoading) return
      if (!user) {
        // not signed in - do not fetch yet
        setIsLoading(false)
        setGames([])
        return
      }
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
        </div>
        <div className="flex-1">{calendar}</div>
        <div className="text-xs text-muted-foreground p-2">
          <p>Select a date to view past scores and upcoming games.</p>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">

        <header className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <HockeyPuckIcon className="w-8 h-8 text-primary md:hidden" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold font-headline text-foreground md:hidden">Siggys Picks</h1>
              <h2 className="text-xl md:text-2xl font-semibold font-headline text-foreground">
                {selectedDate ? `Games for ${format(selectedDate, "EEEE, MMMM d")}` : "Select a date"}
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
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  {calendar}
                </PopoverContent>
              </Popover>
            </div>

            {/* auth - shown above date on small screens */}
            {firebaseConfig.enableAuth && (
              <div className="shrink-0">
                <AuthStrip />
              </div>
            )}
          </div>

        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background/60">
          {authLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground rounded-lg border-2 border-dashed p-8">
              {/* <CalendarIcon className="w-16 h-16 mb-4" /> */}
              <h3 className="text-lg font-semibold font-headline mb-1 text-foreground">
                🐈‍⬛ Please sign in 🐈‍⬛ 
              </h3>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : games.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
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
