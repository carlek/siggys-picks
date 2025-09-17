
import { NextResponse } from "next/server";
import { getGames } from "@/lib/nhl-games"; // keep this file server-only

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date"); // "YYYY-MM-DD"
    if (!dateStr) {
      return NextResponse.json({ error: "Missing ?date" }, { status: 400 });
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);

    const games = await getGames(date);
    return NextResponse.json({ games }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("GET /api/games failed:", err?.stack || err);
    return NextResponse.json(
      { error: "Server failed fetching games", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
