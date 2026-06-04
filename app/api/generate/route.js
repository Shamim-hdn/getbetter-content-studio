import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];

const LENGTHS = {
  "8": { words: "1000-1300", tokens: 10000 },
  "12": { words: "1600-2000", tokens: 14000 },
  "15": { words: "2000-2400", tokens: 18000 },
  "20": { words: "2700-3200", tokens: 26000 },
};

const TONES = {
  dark: "dark psychology, intriguing, slightly edgy, authoritative (think 'use responsibly')",
  motivational: "high-energy, inspiring, motivational and uplifting",
  stoic: "calm, philosophical, stoic, grounded and timeless",
  educational: "clear, practical, science-backed and educational",
};

function buildPrompt({ topic, tone, length, trendTitles }) {
  const toneDesc = TONES[tone] || TONES.motivational;
  const len = LENGTHS[length] || LENGTHS["15"];
  const trendsBlock =
    trendTitles && trendTitles.length
      ? `\n\nHere are top-performing competitor titles in this niche right now (use them to find a gap and beat them, do NOT copy):\n- ${trendTitles.join(
          "\n- "
        )}`
      : "";

  return `You are an elite YouTube content strategist for an English self-improvement / psychology channel called "Get Better" (niche: confidence, charisma, stoicism, dark psychology, discipline, influence). The brand is bold, red-and-black, cinematic.

This week's video topic: "${topic}"
Tone/style: ${toneDesc}
Target length: ~${length} minutes (script of about ${len.words} words).${trendsBlock}

Produce a complete content pack. Return ONLY a valid JSON object with these keys:
- titles: array of 5 high-CTR, curiosity-driven English titles (vary the angle; some bold/uppercase style)
- script: full word-for-word script (~${len.words} words) with a 10-second pattern-interrupt hook, intro, clearly labeled sections [HOOK], [INTRO], [SECTION 1] etc. with vivid examples and stories, and a strong outro with a call-to-action and subscribe ask
- tags: comma-separated YouTube tags, close to 700 characters (not over 700)
- thumbnailPrompt: a precise English prompt for an AI image tool to create a cinematic, high-contrast red/black thumbnail, including composition, facial emotion, lighting and bold text overlay idea
- timestamps: chapter timestamps for the description, each line "00:00 Chapter title", matching the script and length
- youtubeDescription: an SEO-optimized YouTube video description (2-3 short paragraphs) that hooks the viewer, naturally includes target keywords, summarizes the value, then a call-to-action to subscribe, a line for links/socials placeholder, and 3-5 hashtags at the end
- instagramCaption: an engaging Instagram caption with a few emojis and ~10 relevant hashtags
- shortCaption: a punchy caption for a Short/Reel with 3-5 trending hashtags
- seoStrategy: a concise but specific strategy block (string) covering: 5-8 target keywords/search phrases, the single best differentiation angle vs the competitor titles above, the ideal posting hook, and one reason this video can outperform the competition`;
}

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set. Add it in your Vercel settings." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const topic = (body.topic || "").trim();
    const tone = body.tone || "motivational";
    const length = String(body.length || "15");
    const trendTitles = Array.isArray(body.trendTitles) ? body.trendTitles.slice(0, 8) : [];

    let model = body.model && ALLOWED_MODELS.includes(body.model) ? body.model : null;
    if (!model) model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!topic) {
      return NextResponse.json({ error: "Please enter a video topic." }, { status: 400 });
    }

    const len = LENGTHS[length] || LENGTHS["15"];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: buildPrompt({ topic, tone, length, trendTitles }) }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: Math.min(len.tokens + 6000, 32768),
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Gemini API error", detail: await res.text() },
        { status: 502 }
      );
    }

    const data = await res.json();
    const cand = data?.candidates?.[0];
    const finish = cand?.finishReason || "";
    const text = cand?.content?.parts?.map((p) => p.text).join("") || "";

    if (!text) {
      return NextResponse.json(
        { error: "The model returned an empty response.", detail: `finishReason: ${finish}` },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} }
    }

    if (!parsed) {
      const hint =
        finish === "MAX_TOKENS"
          ? "Output was cut off (too long). Try again or pick a shorter length."
          : `finishReason: ${finish}`;
      return NextResponse.json(
        { error: "Could not read the model output.", detail: hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ topic, model, result: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
