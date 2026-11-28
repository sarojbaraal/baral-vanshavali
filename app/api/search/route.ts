// app/api/search/route.ts
// Name / tag / place search for signed-in members. It reads the family only through get_people, so it can
// never return more than that member may see (hidden people, locked fields and private details stay out).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MAX_Q = 60;
const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFC");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim().slice(0, MAX_Q) : "";
    if (query.length < 2) return NextResponse.json({ error: "खोज्ने शब्द कम्तीमा २ अक्षरको चाहिन्छ।" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "लगइन आवश्यक छ।" }, { status: 401 });

    const { data, error } = await supabase.rpc("get_people");
    if (error || !Array.isArray(data)) return NextResponse.json({ error: "खोज्न सकिएन।" }, { status: 500 });

    const q = norm(query);
    const out = (data as Record<string, unknown>[])
      .filter((p) => !p.is_locked)
      .map((p) => {
        const name = norm(p.name);
        const tags = Array.isArray(p.ai_tags) ? (p.ai_tags as unknown[]).map(norm) : [];
        const score = name === q ? 3 : name.startsWith(q) ? 2.5 : name.includes(q) ? 2 : tags.some((t) => t.includes(q)) ? 1 : norm(p.address).includes(q) ? 0.5 : 0;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ p, score }) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        birth_bs: p.birth_bs ?? null,
        death_bs: p.death_bs ?? null,
        address: p.address ?? null,
        ai_summary: p.ai_summary ?? null,
        ai_tags: p.ai_tags ?? [],
        photo_url: p.photo_url ?? null,
        similarity: Math.min(1, score / 3),
      }));
    return NextResponse.json(out);
  } catch (err) {
    console.error("search", (err as Error).message);
    return NextResponse.json({ error: "खोज्न सकिएन।" }, { status: 500 });
  }
}
