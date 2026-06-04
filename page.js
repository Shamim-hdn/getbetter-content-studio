"use client";

import { useState } from "react";

function LogoMark() {
  return (
    <svg className="logo" viewBox="0 0 100 100" width="46" height="46" aria-label="Get Better logo">
      <circle cx="50" cy="50" r="47" fill="#0a0a0a" stroke="#ff2b2b" strokeWidth="3" />
      <g stroke="#fff" strokeWidth="2.1" fill="none" strokeLinecap="round">
        <path d="M50 84 L50 44" />
        <path d="M50 66 L40 54" /><path d="M40 54 L33 47" /><path d="M40 54 L42 45" />
        <path d="M50 60 L61 49" /><path d="M61 49 L68 42" /><path d="M61 49 L59 41" />
        <path d="M50 52 L43 41" /><path d="M50 52 L57 41" />
        <path d="M43 41 L38 34" /><path d="M57 41 L62 34" />
        <path d="M50 46 L50 36" /><path d="M50 40 L45 33" /><path d="M50 40 L55 33" />
      </g>
    </svg>
  );
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={"copy-btn" + (done ? " done" : "")}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text || ""); setDone(true); setTimeout(() => setDone(false), 1500); } catch (e) {}
      }}
    >
      {done ? "✓ Copied" : label || "Copy"}
    </button>
  );
}

function Card({ title, icon, text, className, children }) {
  return (
    <div className={"card fade " + (className || "")}>
      <h3>
        <span><span className="ic">{icon}</span>{title}</span>
        {text != null && <CopyButton text={text} />}
      </h3>
      {children}
    </div>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString("en-US"); }

export default function Home() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("dark");
  const [length, setLength] = useState("15");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [trends, setTrends] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingGen, setLoadingGen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function fetchTrends() {
    setError(""); setLoadingTrends(true); setTrends([]); setStats(null);
    try {
      const res = await fetch("/api/trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch trends");
      setTrends(data.trends || []); setStats(data.stats || null);
    } catch (e) { setError(e.message); }
    finally { setLoadingTrends(false); }
  }

  async function generate(selectedTopic) {
    const t = (selectedTopic || topic).trim();
    if (!t) { setError("Enter a topic or click one of the trends first."); return; }
    setError(""); setResult(null); setLoadingGen(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, tone, length, model, trendTitles: trends.slice(0, 8).map((x) => x.title) }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch (pe) {
        if (res.status === 504 || /timeout|timed out/i.test(raw))
          throw new Error("The server timed out (Pro can be slow). Try again, or switch the model to Flash.");
        throw new Error("Invalid server response:\n" + raw.slice(0, 300));
      }
      if (!res.ok) {
        const d = data.detail ? "\n" + (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : "";
        throw new Error((data.error || "Generation failed") + d);
      }
      setResult(data.result);
      window.scrollTo({ top: 99999, behavior: "smooth" });
    } catch (e) { setError(e.message); }
    finally { setLoadingGen(false); }
  }

  function copyAll() {
    if (!result) return;
    const r = result;
    const txt = [
      "TITLES:\n" + (r.titles || []).join("\n"),
      "SEO STRATEGY:\n" + (r.seoStrategy || ""),
      "SCRIPT:\n" + (r.script || ""),
      "YOUTUBE DESCRIPTION:\n" + (r.youtubeDescription || ""),
      "TAGS:\n" + (r.tags || ""),
      "THUMBNAIL PROMPT:\n" + (r.thumbnailPrompt || ""),
      "TIMESTAMPS:\n" + (r.timestamps || ""),
      "INSTAGRAM:\n" + (r.instagramCaption || ""),
      "SHORT:\n" + (r.shortCaption || ""),
    ].join("\n\n———\n\n");
    navigator.clipboard.writeText(txt).catch(() => {});
  }

  const tagsLen = result?.tags ? result.tags.length : 0;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <img className="logo" src="/logo.svg" alt="Get Better logo" />
          <div>
            <h1>Get Better — AI Content Studio</h1>
            <div className="sub">Trends → script → SEO, in one click</div>
          </div>
        </div>
        <div className="badge">AI Powered</div>
      </div>

      <div className="panel">
        <label>Video topic (optional — leave empty to pull from trends)</label>
        <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. The Dark Psychology of Staying Silent"
          onKeyDown={(e) => e.key === "Enter" && generate()} />

        <div className="controls">
          <div>
            <label>Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="dark">Dark psychology</option>
              <option value="motivational">Motivational</option>
              <option value="stoic">Stoic</option>
              <option value="educational">Educational</option>
            </select>
          </div>
          <div>
            <label>Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value)}>
              <option value="8">~8 min</option>
              <option value="12">~12 min</option>
              <option value="15">~15 min</option>
              <option value="20">~20 min</option>
            </select>
          </div>
          <div>
            <label>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gemini-2.5-flash">Flash (fast)</option>
              <option value="gemini-2.5-pro">Pro (best quality)</option>
            </select>
          </div>
        </div>

        <div className="row">
          <button className="btn-primary" disabled={loadingGen} onClick={() => generate()}>
            {loadingGen ? "Generating..." : "✨ Generate Content Pack"}
          </button>
          <button className="btn-ghost" disabled={loadingTrends} onClick={fetchTrends}>
            {loadingTrends ? "..." : "🔍 Analyze Trends"}
          </button>
        </div>

        {stats && (
          <div className="stats fade">
            <div className="stat"><div className="k">Videos</div><div className="v">{stats.count}</div></div>
            <div className="stat"><div className="k">Avg views</div><div className="v red">{fmt(stats.avgViews)}</div></div>
            <div className="stat"><div className="k">Top video</div><div className="v">{fmt(stats.maxViews)}</div></div>
            <div className="stat"><div className="k">Top channel</div><div className="v" style={{ fontSize: 14 }}>{stats.topChannel}</div></div>
          </div>
        )}

        {trends.length > 0 && (
          <div className="trends">
            {trends.map((tr) => (
              <button key={tr.id} className="trend" onClick={() => generate(tr.title)}>
                {tr.thumbnail && <img src={tr.thumbnail} alt="" />}
                <div className="meta">
                  <div className="t-title">{tr.title}</div>
                  <div className="t-sub">{tr.channel} · {fmt(tr.views)} views</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error">⚠️ {error}</div>}

      {loadingGen && (
        <div className="panel loading">
          <div className="spinner" />
          Writing your {length}-minute script, SEO strategy and captions... ({model.includes("pro") ? "Pro may take up to a minute" : "almost there"})
        </div>
      )}

      {result && (
        <div>
          <div className="result-head">
            <h2>Your content pack</h2>
            <button className="copy-all" onClick={copyAll}>📋 Copy all</button>
          </div>

          <Card title="Titles" icon="🎬">
            {(result.titles || []).map((t, i) => (
              <div className="title-opt" key={i}><span>{t}</span><CopyButton text={t} /></div>
            ))}
          </Card>

          {result.seoStrategy && (
            <Card title="SEO & Competition Strategy" icon="📈" text={result.seoStrategy} className="seo">
              <div className="box">{result.seoStrategy}</div>
            </Card>
          )}

          <Card title={`Script (~${length} min)`} icon="📝" text={result.script}>
            <div className="box">{result.script}</div>
          </Card>

          {result.youtubeDescription && (
            <Card title="YouTube Description" icon="📄" text={result.youtubeDescription}>
              <div className="box">{result.youtubeDescription}</div>
            </Card>
          )}

          <Card title="Tags" icon="🏷️" text={result.tags}>
            <div className="box">{result.tags}</div>
            <div className="count">{tagsLen} chars {tagsLen > 700 ? "(over 700 — trim a little)" : "(good)"}</div>
          </Card>

          <Card title="Thumbnail Prompt" icon="🖼️" text={result.thumbnailPrompt}>
            <div className="box">{result.thumbnailPrompt}</div>
          </Card>

          <Card title="Timestamps" icon="⏱️" text={result.timestamps}>
            <div className="box">{result.timestamps}</div>
          </Card>

          <Card title="Instagram Caption" icon="📸" text={result.instagramCaption}>
            <div className="box">{result.instagramCaption}</div>
          </Card>

          <Card title="Short / Reel Caption" icon="⚡" text={result.shortCaption}>
            <div className="box">{result.shortCaption}</div>
          </Card>
        </div>
      )}

      <div className="footer">Built for the Get Better channel · AI content engine</div>
    </div>
  );
}
