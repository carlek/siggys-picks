import { decode } from "he";

export type TextExtract = {
  url: string;
  title: string;
  byline?: string;
  published?: string;
  paragraphs: string[];
  text: string;
};

const SUMMARY_API =
  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary";

function parseGameId(url: string): string | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("gameId") || u.searchParams.get("eventId");
    if (id) return id;
    const m = u.pathname.match(/\/(\d{6,})(?:[\/?#]|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function storyToParagraphs(story: string): string[] {
  return story
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .split(/<\/(?:p|div|h\d|li)>/i)
    .map((b) => decode(b.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function extractTextFromUrl(url: string): Promise<TextExtract> {
  const gameId = parseGameId(url);
  if (!gameId) {
    throw new Error(`Could not parse gameId from URL: ${url}`);
  }

  const apiUrl = `${SUMMARY_API}?event=${encodeURIComponent(gameId)}`;
  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`extractTextFromUrl: ${res.status}`);
  }
  const data: any = await res.json();

  const article = data?.article ?? {};
  const story: string = article.story ?? "";
  const paragraphs = storyToParagraphs(story);

  const title: string =
    article.headline ||
    article.shortHeadline ||
    data?.header?.competitions?.[0]?.note ||
    "";

  const byline: string | undefined = article.byline || undefined;
  const published: string | undefined = article.published || undefined;

  return {
    url: apiUrl,
    title: decode(title),
    byline: byline ? decode(byline) : undefined,
    published,
    paragraphs,
    text: paragraphs.join("\n\n"),
  };
}
