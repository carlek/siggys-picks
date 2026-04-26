import type { NextRequest } from "next/server";
import { extractTextFromUrl } from "@/lib/text-extract";
import { summarizeWithoutAI, summarizeAsSiggy } from "@/ai/genkit";

export const dynamic = "force-dynamic";
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

    if (article.text === '') {
      return new Response(
        JSON.stringify({
          title: article.title,
          byline: article.byline,
          published: article.published,
          summary: "🐈‍⬛ Siggy's working on a preview/recap, come back later...",
          url: article.url,
          siggyUnavailable: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    let summary: string;
    let siggyUnavailable = false;
    try {
      summary = await summarizeAsSiggy(article.text, kind, {
        maxChars: 12000,
        maxTokens: 1024,
      });
    } catch (aiErr: any) {
      const aiMessage = aiErr?.message || "";
      const aiStatus = aiErr?.status ?? aiErr?.statusCode;
      const isRateLimited =
        aiStatus === 429 || /\b429\b|too many requests|rate.?limit|quota/i.test(aiMessage);
      if (!isRateLimited) throw aiErr;

      summary = await summarizeWithoutAI(article.text, { maxSentences: 8 });
      siggyUnavailable = true;
    }

    return new Response(
      JSON.stringify({
        title: article.title,
        byline: article.byline,
        published: article.published,
        summary,
        url: article.url,
        siggyUnavailable,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "summarize failed" }), {
      status: 500,
    });
  }
}
