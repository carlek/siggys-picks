'use server';

import { formatInTimeZone } from 'date-fns-tz';

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
}

const teamColors: { [key: string]: string } = {
  'Boston Bruins': '#FFB81C',
  'Buffalo Sabres': '#002654',
  'Detroit Red Wings': '#CE1126',
  'Florida Panthers': '#C8102E',
  'Montréal Canadiens': '#AF1E2D',
  'Ottawa Senators': '#C52032',
  'Tampa Bay Lightning': '#002868',
  'Toronto Maple Leafs': '#00205B',
  'Carolina Hurricanes': '#CC0000',
  'Columbus Blue Jackets': '#002654',
  'New Jersey Devils': '#CE1126',
  'New York Islanders': '#00539B',
  'New York Rangers': '#0038A8',
  'Philadelphia Flyers': '#F74902',
  'Pittsburgh Penguins': '#FCB514',
  'Washington Capitals': '#C8102E',
  'Chicago Blackhawks': '#CF0A2C',
  'Colorado Avalanche': '#6F263D',
  'Dallas Stars': '#006847',
  'Minnesota Wild': '#154734',
  'Nashville Predators': '#FFB81C',
  'St. Louis Blues': '#002F87',
  'Winnipeg Jets': '#041E42',
  'Anaheim Ducks': '#F47A38',
  'Arizona Coyotes': '#8C2633',
  'Calgary Flames': '#C8102E',
  'Edmonton Oilers': '#FF4C00',
  'Los Angeles Kings': '#111111',
  'San Jose Sharks': '#006D75',
  'Seattle Kraken': '#001628',
  'Vancouver Canucks': '#00205B',
  'Vegas Golden Knights': '#B4975A',
};

const getTeamCity = (teamName: string) => {
  if (!teamName) return 'Unknown';
  const parts = teamName.split(' ');
  if (parts.length <= 1) return teamName;
  if (parts.length > 2) {
    if (['New', 'Tampa', 'St.', 'San', 'Los'].includes(parts[0])) {
      return `${parts[0]} ${parts[1]}`;
    }
  }
  return parts.slice(0, -1).join(' ');
};

const getTeamName = (teamName: string) => {
  if (!teamName) return 'Team';
  const parts = teamName.split(' ');
  return parts[parts.length - 1];
};

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

  const url = `https://nhl-api5.p.rapidapi.com/nhlscoreboard?year=${year}&month=${month}&day=${day}`;

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
      };
    });
  } catch (error: any) {
    console.error('Failed to fetch games:', error.message);
    throw new Error(`Server-side error fetching games: ${error.message}`);
  }
}
