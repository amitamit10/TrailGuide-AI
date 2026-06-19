import { NextRequest, NextResponse } from "next/server";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// GET /api/places/photo?query=Senso-ji+Temple+Tokyo&w=400
// Strategy: try Wikipedia real photo first → fall back to Unsplash
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const photoUrl = await getWikipediaPhoto(query) ?? await getUnsplashPhoto(query);

  if (!photoUrl) return NextResponse.json({ error: "no photo found" }, { status: 404 });

  // Proxy the bytes so html2canvas can read cross-origin images without CORS issues
  try {
    const imgRes = await fetch(photoUrl);
    if (!imgRes.ok) throw new Error("upstream failed");
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.redirect(photoUrl);
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
