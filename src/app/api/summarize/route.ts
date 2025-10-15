import type { NextRequest } from "next/server";
import { extractTextFromUrl } from "@/lib/text-extract";
import { summarizeWithoutAI, summarizeAsSiggy } from "@/ai/genkit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const kindParam = req.nextUrl.searchParams.get('kind');
  const kind = kindParam === 'preview' ? 'preview' : 'recap'; // default to recap

  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
  }

  try {
    const article = await extractTextFromUrl(url);
    // const summary = await summarizeWithoutAI(article.text, { maxSentences: 8 });
    const summarySiggy = await summarizeAsSiggy(article.text, kind,
      {
        maxChars: 12000,
        maxTokens: 1024, 
      });

    return new Response(
      JSON.stringify({
        title: article.title,
        byline: article.byline,
        published: article.published,
        summary: summarySiggy,
        url: article.url,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "summarize failed" }), {
      status: 500,
    });
  }
}
