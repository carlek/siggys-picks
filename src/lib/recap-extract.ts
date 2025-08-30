// src/lib/recap-extract.ts
import { load } from "cheerio";
import { decode } from "he";

export type RecapExtract = {
  url: string;
  title: string;
  byline?: string;
  published?: string;
  paragraphs: string[];
  text: string;
};

export async function extractRecapFromUrl(url: string): Promise<RecapExtract> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Upstream ${res.status}`);
  }
  const html = await res.text();
  return extractRecapFromHtml(html, url);
}

export function extractRecapFromHtml(html: string, url: string): RecapExtract {
  const $ = load(html);

  const clean = (s: string) => decode((s || "").replace(/\s+/g, " ").trim());

  // Title: ESPN often uses h1.Story__Headline.h1; fall back to og:title or <title>
  const h1 = $("h1.Story__Headline.h1").first().text();
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const docTitle = $("title").first().text() || "";
  const title = clean(h1 || ogTitle || docTitle);

  // Byline and published time - best effort
  const byline =
    clean($("[class*='Byline'], .Author").first().text()) ||
    clean($("span[rel='author']").first().text()) ||
    undefined;

  const published =
    $("meta[property='article:published_time']").attr("content") ||
    $("time[datetime]").attr("datetime") ||
    undefined;

  // Try a few likely article containers to be resilient to markup changes
  const paragraphs = extractParagraphs($, clean);

  return {
    url,
    title,
    byline,
    published,
    paragraphs,
    text: paragraphs.join("\n\n"),
  };
}

function extractParagraphs($: ReturnType<typeof load>, clean: (s: string) => string): string[] {
  const containers = [
    ".Story__Body",
    ".article-body",
    ".Article__Content",
    ".Article__Body",
    "article",
    "main",
  ];

  for (const sel of containers) {
    const ps = $(sel).find("p");
    const list = ps
      .toArray()
      .map((p: any) => clean($(p).text()))
      .filter((t: string | any[]) => t.length > 0);
    if (list.length > 0) return list;
  }

  // Fallback: take first 20 paragraphs found anywhere
  return $("p")
    .toArray()
    .map((p: any) => clean($(p).text()))
    .filter(Boolean)
    .slice(0, 20);
}
