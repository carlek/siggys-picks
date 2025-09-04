'use server';

import { formatInTimeZone } from 'date-fns-tz';
import { getTeamCity, getTeamName, teamColors } from './nhl-teams';
import { GameOdds, getOddsForEvents } from './nhl-odds';

export interface Team {
  id: number;
  name: string;
  city: string;
  logoColor: string; // This will be hardcoded for now
}

export interface Game {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  date: Date;
  status: 'FINAL' | 'SCHEDULED' | 'LIVE';
  homeScore?: number;
  awayScore?: number;
  gameTime: string;
  recapUrl?: string;
  recapTitle?: string; // optional cache 

  homeMoneyline: number | null;
  homePointSpread: number | null;
  awayMoneyline: number | null;
  awayPointSpread: number | null;
  odds: GameOdds | null;
}

const getGameStatus = (status: any): 'FINAL' | 'SCHEDULED' | 'LIVE' => {
  const state = status.type.state;
  if (state === 'post') return 'FINAL';
  if (state === 'in') return 'LIVE';
  return 'SCHEDULED';
};

export async function getGames(date: Date): Promise<Game[]> {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const apiKey = process.env.NHL_API_KEY;
  const apiHost = 'nhl-api5.p.rapidapi.com';

  if (!apiKey) {
    throw new Error('NHL_API_KEY is not defined in environment variables.');
  }

  const url = `https://${apiHost}/nhlscoreboard?year=${year}&month=${month}&day=${day}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`API call failed with status ${response.status}: ${errorBody}`);
      console.error(error);
      throw error;
    }

    const data = await response.json();

    if (!data.events || !Array.isArray(data.events)) {
      console.warn('API response did not contain an "events" array.', data);
      return [];
    }

    const eventIds: string[] = data.events.map((e: any) => String(e.id));
    const oddsMap = await getOddsForEvents(eventIds); // Record<eventId, GameOdds | null>

    return data.events.map((event: any): Game => {
      const competition = event.competitions[0];
      const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');
      const homeTeamName = homeCompetitor.team.displayName;
      const awayTeamName = awayCompetitor.team.displayName;
      const easternTimeZone = 'America/New_York';

      // Find the ESPN recap link if present
      const recapLink = Array.isArray(event.links)
        ? event.links.find(
          (l: any) =>
            l &&
            typeof l === "object" &&
            l.href &&
            (l.text.toLowerCase() === "recap" || l.shortText.toLowerCase() === "recap")
          )?.href
        : undefined;
      
      const odds = oddsMap[String(event.id)] ?? null;

      return {
        id: event.id,
        homeTeam: {
          id: homeCompetitor.team.id,
          name: getTeamName(homeTeamName),
          city: getTeamCity(homeTeamName),
          logoColor: teamColors[homeTeamName] || '#CCCCCC',
        },
        awayTeam: {
          id: awayCompetitor.team.id,
          name: getTeamName(awayTeamName),
          city: getTeamCity(awayTeamName),
          logoColor: teamColors[awayTeamName] || '#CCCCCC',
        },
        date: new Date(event.date),
        status: getGameStatus(event.status),
        homeScore: parseInt(homeCompetitor.score, 10),
        awayScore: parseInt(awayCompetitor.score, 10),
        gameTime: formatInTimeZone(new Date(event.date), easternTimeZone, 'h:mm a'),
        recapUrl: recapLink,

        homeMoneyline: odds?.home.moneyline ?? null,
        homePointSpread: odds?.home.pointSpread ?? null,
        awayMoneyline: odds?.away.moneyline ?? null,
        awayPointSpread: odds?.away.pointSpread ?? null,
        odds, // full payload

      };
    });
  } catch (error: any) {
    console.error('Failed to fetch games:', error.message);
    throw new Error(`Server-side error fetching games: ${error.message}`);
  }
}
