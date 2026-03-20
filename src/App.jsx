import { useState } from "react";
import mockData from "./mockData.json";
import { fetchGitHubData } from "./api/github";
import { fetchCodeforcesData } from "./api/codeforces";
import { analyzeWithGemini } from "./api/gemini";

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);
const WarnIcon = () => (
  <svg className="w-3.5 h-3.5 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);
const XIcon = () => (
  <svg className="w-3.5 h-3.5 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);
const GithubIcon = () => (
  <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);
const CodeIcon = () => (
  <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
  </svg>
);

function SkillBadge({ skill, type }) {
  const styles = {
    verified: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    learnable: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    missing: "bg-red-500/20 text-red-300 border border-red-500/30",
  };
  const icons = { verified: <CheckIcon />, learnable: <WarnIcon />, missing: <XIcon /> };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles[type]}`}>
      {icons[type]}{skill}
    </span>
  );
}

function BarChart({ items, colors }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map(({ label, value }, idx) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-24 truncate shrink-0">{label}</span>
          <div className="flex-1 bg-slate-800 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${(value / max) * 100}%`, background: colors[idx % colors.length] }} />
          </div>
          <span className="text-xs text-slate-400 w-6 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }) {
  const total = segments.reduce((s, i) => s + i.value, 0) || 1;
  let offset = 0;
  const r = 40, cx = 50, cy = 50, circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0">
        {segments.map(({ value, color }, i) => {
          const pct = value / total;
          const dash = pct * circ;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="18"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset * circ}
              style={{ transition: "stroke-dasharray 0.7s" }} />
          );
          offset += pct;
          return el;
        })}
      </svg>
      <div className="space-y-1">
        {segments.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-slate-300">{label}</span>
            <span className="text-slate-500 ml-auto pl-2">{Math.round(value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreRing({ score }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000" />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-slate-400">/100</span>
      </div>
    </div>
  );
}

const STEPS = ["Fetching GitHub data...", "Fetching Codeforces data...", "Running analysis..."];

export default function App() {
  const [form, setForm] = useState({ github: "", codeforces: "", jobDesc: "" });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  const useMock = !import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY === "<your_gemini_api_key>";

  const handleAnalyze = async () => {
    setError("");
    setLoading(true);
    setResults(null);

    if (useMock) {
      // Demo mode: simulate steps with mock data
      for (let i = 0; i < STEPS.length; i++) {
        setStep(i);
        await new Promise(r => setTimeout(r, 800));
      }
      setResults({ ...mockData, github: mockData.github, codeforces: mockData.codeforces });
      setLoading(false);
      return;
    }

    try {
      setStep(0);
      const githubData = await fetchGitHubData(form.github);

      setStep(1);
      const cfData = await fetchCodeforcesData(form.codeforces);

      setStep(2);
      const aiResult = await analyzeWithGemini({ githubData, cfData, jobDescription: form.jobDesc });

      setResults({
        ...aiResult,
        github: githubData,
        codeforces: cfData,
      });
    } catch (e) {
      setError(e.message || "Something went wrong. Check your inputs and API keys.");
    } finally {
      setLoading(false);
    }
  };

  const data = results;
  const skills = data ? {
    verified: (data.skillSimilarity || []).filter(s => s.status === "verified").map(s => s.skill),
    learnable: (data.skillSimilarity || []).filter(s => s.status === "learnable").map(s => s.skill),
    missing: (data.skillSimilarity || []).filter(s => s.status === "missing").map(s => s.skill),
  } : null;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs text-indigo-300 mb-6">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
            AI-Powered Skill Verification
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Beyond Resume —<br />Hire by Proof, Not Claims
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Verify real skills using GitHub activity and Codeforces ratings. Get an AI-generated match score before the first interview.
          </p>
          {useMock && (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-xs text-amber-300">
              ⚡ Demo mode — add VITE_GEMINI_API_KEY to .env for live analysis
            </div>
          )}
        </div>

        {/* Input Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl mb-10">
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">GitHub Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><GithubIcon /></span>
                <input type="text" placeholder="e.g. torvalds" value={form.github}
                  onChange={e => setForm({ ...form, github: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Codeforces Handle</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><CodeIcon /></span>
                <input type="text" placeholder="e.g. tourist" value={form.codeforces}
                  onChange={e => setForm({ ...form, codeforces: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Job Description</label>
              <textarea rows={4} placeholder="Paste the job description here..." value={form.jobDesc}
                onChange={e => setForm({ ...form, jobDesc: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all resize-none" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                ⚠ {error}
              </div>
            )}

            {loading && (
              <div className="space-y-2">
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-2 text-xs transition-all ${i < step ? "text-emerald-400" : i === step ? "text-indigo-300" : "text-slate-600"}`}>
                    {i < step ? <CheckIcon /> : i === step ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : <span className="w-3.5 h-3.5 inline-block" />}
                    {s}
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleAnalyze} disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]">
              {loading ? "Analyzing..." : "Analyze Candidate"}
            </button>
          </div>
        </div>

        {/* Results */}
        {data && (
          <div className="space-y-5" style={{ animation: "fadeIn 0.4s ease-out" }}>

            {/* Score Card */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/20 rounded-2xl p-8 text-center shadow-xl">
              <ScoreRing score={data.score} />
              <h2 className="text-2xl font-bold mt-4 text-white">{data.label}</h2>
              <p className="text-slate-400 text-sm mt-1">Overall candidate match score</p>
            </div>

            {/* Skill Breakdown */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Skill Breakdown</h3>
              <div className="space-y-4">
                {[["verified", "Verified"], ["learnable", "Learnable"], ["missing", "Missing"]].map(([type, label]) => (
                  <div key={type}>
                    <p className="text-xs text-slate-500 mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {skills[type].map(s => <SkillBadge key={s} skill={s} type={type} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Match Chart */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Skill Match Overview</h3>
              <BarChart
                items={[
                  { label: "Verified", value: skills.verified.length },
                  { label: "Learnable", value: skills.learnable.length },
                  { label: "Missing", value: skills.missing.length },
                ]}
                colors={["#10b981", "#f59e0b", "#ef4444"]}
              />
            </div>

            {/* Signals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center text-slate-400 text-xs mb-3"><GithubIcon />GitHub Languages</div>
                <DonutChart
                  segments={(data.github.languageData || data.github.languages.map(l => ({ lang: l, count: 1 }))).map((l, i) => ({                    label: l.lang, value: l.count,
                    color: ["#6366f1","#06b6d4","#10b981","#f59e0b","#ec4899"][i % 5],
                  }))}
                />
                <p className="text-slate-500 text-xs mt-3">{data.github.repos} public repos</p>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center text-slate-400 text-xs mb-3"><CodeIcon />Codeforces Signal</div>
                <p className="text-white font-semibold text-lg">Rating: {data.codeforces.rating}</p>
                <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full mt-1 inline-block">
                  {data.codeforces.rank}
                </span>
                {(data.codeforces.tagData || data.codeforces.topTags?.map((t,i) => ({ tag: t, count: 5-i })))?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2">Top problem topics</p>
                    <BarChart
                      items={(data.codeforces.tagData || data.codeforces.topTags.map((t,i) => ({ tag: t, count: 5-i }))).map(t => ({ label: t.tag, value: t.count }))}
                      colors={["#06b6d4"]}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Learning Prediction */}
            <div className="backdrop-blur-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5 shadow-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-amber-400/70 mb-0.5">Learning Prediction</p>
                <p className="text-white font-semibold">{data.learningPrediction}</p>
              </div>
            </div>

            {/* AI Insight */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/30 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white">AI Insight</h3>
                {!useMock && <span className="ml-auto text-xs text-indigo-400/60">LateLateef</span>}
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{data.aiInsight}</p>
            </div>

          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
