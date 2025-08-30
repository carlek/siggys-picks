import type { NextRequest } from "next/server"
import { decode } from "he"

// Extract the H1 and decode entities like &ldquo; &rsquo; etc.
function extractTitle(html: string): string | null {
  const h1 = html.match(/<h1[^>]*class="[^"]*Story__Headline[^"]*h1[^"]*"[^>]*>([^<]+)<\/h1>/i)
  if (h1 && h1[1]) return decode(h1[1].trim())

  // Fallback to <title>
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (t && t[1]) return decode(t[1].trim())

  return null
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 })
  }
  try {
    // Server-side fetch avoids CORS
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${res.status}` }), { status: 502 })
    }
    const html = await res.text()
    const title = extractTitle(html) || ""

    // In case the source returns literal \u2019 sequences as text,
    // normalize those to real Unicode characters.
    const normalized = title
      .replace(/\\u2019/g, "'")
      .replace(/\\u2018/g, "'")
      .replace(/\\u201c/g, '"')
      .replace(/\\u201d/g, '"')

    return new Response(JSON.stringify({ title: normalized }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "fetch failed" }), { status: 500 })
  }
}
