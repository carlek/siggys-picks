import type { NextRequest } from "next/server";
import { extractRecapFromUrl } from "@/lib/recap-extract";
import { summarizeWithAI, summarizeAsSiggy } from "@/ai/genkit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
  }

  try {
    const recap = await extractRecapFromUrl(url);
    const summary = await summarizeWithAI(recap.text, { maxSentences: 8 });
    const summarySiggy = await summarizeAsSiggy(recap.text,
      {
        maxChars: 12000,
        maxTokens: 1024, 
      });

    return new Response(
      JSON.stringify({
        title: recap.title,
        byline: recap.byline,
        published: recap.published,
        summary: summarySiggy,
        url: recap.url,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "summarize failed" }), {
      status: 500,
    });
  }
}
