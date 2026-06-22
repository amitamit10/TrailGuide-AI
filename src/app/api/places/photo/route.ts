import { NextRequest, NextResponse } from "next/server";
import { publicRatelimit, clientIp } from "@/lib/ratelimit";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// SSRF guard: only ever proxy bytes from these hosts over https, and only image
// content-types. Mirrors the hardening in the Python ai-service photos router.
const SAFE_HOSTS = ["upload.wikimedia.org", "images.unsplash.com"];
const SAFE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return SAFE_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

// GET /api/places/photo?query=Senso-ji+Temple+Tokyo&w=400
// Strategy: try Wikipedia real photo first → fall back to Unsplash
export async function GET(req: NextRequest) {
  const { success } = await publicRatelimit.limit(clientIp(req));
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const photoUrl = await getWikipediaPhoto(query) ?? await getUnsplashPhoto(query);

  if (!photoUrl || !isSafeUrl(photoUrl))
    return NextResponse.json({ error: "no photo found" }, { status: 404 });

  // Proxy the bytes so html2canvas can read cross-origin images without CORS issues
  try {
    const imgRes = await fetch(photoUrl);
    if (!imgRes.ok) throw new Error("upstream failed");
    let contentType = (imgRes.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!SAFE_TYPES.has(contentType)) contentType = "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
}

async function getWikipediaPhoto(query: string): Promise<string | null> {
  try {
    // Step 1: search Wikipedia for the most relevant article
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`,
      { next: { revalidate: 86400 } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const title: string | undefined = searchData.query?.search?.[0]?.title;
    if (!title) return null;

    // Step 2: get the page image for that article
    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&format=json&origin=*`,
      { next: { revalidate: 86400 } }
    );
    if (!imgRes.ok) return null;
    const imgData = await imgRes.json();
    const pages = imgData.query?.pages ?? {};
    const page = Object.values(pages)[0] as { thumbnail?: { source: string } };
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function getUnsplashPhoto(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.urls?.regular ?? null;
  } catch {
    return null;
  }
}
