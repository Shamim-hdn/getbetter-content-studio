import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_QUERIES = [
  "dark psychology",
  "confidence",
  "charisma",
  "stoicism",
  "self discipline",
  "self improvement",
  "psychology tricks",
  "body language",
  "how to be respected",
  "mindset",
  "productivity",
  "influence people",
];

// Filters to keep English content and drop Hindi / Hinglish
const DEVANAGARI = /[ऀ-ॿ]/;
const HINDI_HINT = /\b(hindi|kaise|kya|kyun|kyu|nahi|hai|aur|zindagi|safalta|paisa|wala|jeevan|mera|apni|karein|kare|hindime)\b/i;
const HAS_LATIN = /[A-Za-z]/;

function searchUrl(query, apiKey, publishedAfter, duration) {
  return (
    `https://www.googleapis.com/youtube/v3/search?part=snippet` +
    `&q=${encodeURIComponent(query)}` +
    `&type=video&maxResults=25&order=viewCount&relevanceLanguage=en&regionCode=US` +
    `&videoDuration=${duration}` +
    `&publishedAfter=${publishedAfter}&key=${apiKey}`
  );
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export async function POST(req) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY is not set. Add it in your Vercel settings." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userQuery = (body.query || "").trim();
    const query =
      userQuery || DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];

    const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const durations = ["medium", "long"];
    let items = [];
    for (const d of durations) {
      const res = await fetch(searchUrl(query, apiKey, publishedAfter, d));
      if (res.ok) {
        const data = await res.json();
        items = items.concat(data.items || []);
      }
    }

    const seen = new Set();
    items = items.filter((it) => {
      const id = it.id && it.id.videoId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const videoIds = items.map((it) => it.id.videoId);
    let statsMap = {};
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics` +
          `&id=${chunk.join(",")}&key=${apiKey}`
      );
      if (r.ok) {
        const d = await r.json();
        (d.items || []).forEach((v) => {
          statsMap[v.id] = {
            views: Number(v.statistics?.viewCount || 0),
            likes: Number(v.statistics?.likeCount || 0),
          };
        });
      }
    }

    const trends = items
      .map((it) => {
        const id = it.id.videoId;
        const st = statsMap[id] || {};
        return {
          id,
          title: it.snippet.title,
          channel: it.snippet.channelTitle,
          publishedAt: it.snippet.publishedAt,
          thumbnail: it.snippet.thumbnails?.medium?.url || "",
          url: `https://www.youtube.com/watch?v=${id}`,
          views: st.views || 0,
          likes: st.likes || 0,
        };
      })
      .filter((t) => {
        const text = `${t.title} ${t.channel}`;
        if (/#?shorts?\b/i.test(t.title)) return false;
        if (DEVANAGARI.test(text)) return false; // Hindi script
        if (HINDI_HINT.test(text)) return false; // Hinglish
        if (!HAS_LATIN.test(t.title)) return false; // keep English titles
        return true;
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    const views = trends.map((t) => t.views);
    const channelCount = {};
    trends.forEach((t) => (channelCount[t.channel] = (channelCount[t.channel] || 0) + 1));
    const topChannel =
      Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    const stats = {
      count: trends.length,
      avgViews: views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0,
      medianViews: median(views),
      maxViews: views.length ? Math.max(...views) : 0,
      topChannel,
    };

    return NextResponse.json({ query, trends, stats });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
