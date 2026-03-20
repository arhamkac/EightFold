import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import requests
import json

st.set_page_config(page_title="Proof-of-Skill Engine", page_icon="⚡", layout="wide")

st.markdown("""
<style>
  [data-testid="stAppViewContainer"] { background: #0a0f1e; color: white; }
  [data-testid="stSidebar"] { background: #0d1424; }
  .metric-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 20px; text-align: center;
  }
  .score-big { font-size: 3rem; font-weight: 800; background: linear-gradient(135deg,#6366f1,#06b6d4);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .section-title { font-size: 1rem; font-weight: 600; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
  .badge-green { background: rgba(16,185,129,0.2); color: #6ee7b7;
    border: 1px solid rgba(16,185,129,0.3); border-radius: 20px;
    padding: 4px 12px; font-size: 0.75rem; display: inline-block; margin: 3px; }
  .badge-yellow { background: rgba(245,158,11,0.2); color: #fcd34d;
    border: 1px solid rgba(245,158,11,0.3); border-radius: 20px;
    padding: 4px 12px; font-size: 0.75rem; display: inline-block; margin: 3px; }
  .badge-red { background: rgba(239,68,68,0.2); color: #fca5a5;
    border: 1px solid rgba(239,68,68,0.3); border-radius: 20px;
    padding: 4px 12px; font-size: 0.75rem; display: inline-block; margin: 3px; }
  .insight-box { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3);
    border-radius: 12px; padding: 16px; margin: 8px 0; }
  .warn-box { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 12px; padding: 16px; margin: 8px 0; }
  .danger-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 12px; padding: 16px; margin: 8px 0; }
  .success-box { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);
    border-radius: 12px; padding: 16px; margin: 8px 0; }
  div[data-testid="stTabs"] button { color: #94a3b8 !important; }
  div[data-testid="stTabs"] button[aria-selected="true"] { color: #6366f1 !important; border-bottom-color: #6366f1 !important; }
</style>
""", unsafe_allow_html=True)

BACKEND = "http://localhost:8000"

# ── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚡ Proof-of-Skill Engine")
    st.markdown("---")
    github_user = st.text_input("GitHub Username", placeholder="e.g. torvalds")
    cf_handle   = st.text_input("Codeforces Handle", placeholder="e.g. tourist")
    resume_file = st.file_uploader("Upload Resume", type=["pdf", "docx", "txt"])
    job_desc    = st.text_area("Job Description", height=180, placeholder="Paste job description...")
    analyze_btn = st.button("⚡ Analyze Candidate", use_container_width=True)
    st.markdown("---")
    st.caption("Powered by Gemini AI · GitHub API · Codeforces API")

# ── Fetch GitHub & CF data ────────────────────────────────────────────────────
@st.cache_data(ttl=300)
def get_github(username):
    try:
        r = requests.get(f"https://api.github.com/users/{username}", timeout=5)
        repos_r = requests.get(f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated", timeout=5)
        if r.status_code != 200:
            return {}
        user = r.json()
        repos = repos_r.json() if repos_r.status_code == 200 else []
        lang_count = {}
        for repo in repos:
            if repo.get("language"):
                lang_count[repo["language"]] = lang_count.get(repo["language"], 0) + 1
        languages = sorted(lang_count, key=lang_count.get, reverse=True)[:5]
        return {
            "repos": user.get("public_repos", 0),
            "languages": languages,
            "summary": f"{user.get('public_repos',0)} repos · {', '.join(languages)}",
            "bio": user.get("bio", ""),
            "topRepos": [{"name": r["name"], "stars": r["stargazers_count"], "lang": r.get("language")} for r in repos[:5]],
            "followers": user.get("followers", 0),
        }
    except:
        return {}

@st.cache_data(ttl=300)
def get_cf(handle):
    try:
        r = requests.get(f"https://codeforces.com/api/user.info?handles={handle}", timeout=5)
        sub_r = requests.get(f"https://codeforces.com/api/user.status?handle={handle}&from=1&count=200", timeout=5)
        if r.status_code != 200 or r.json().get("status") != "OK":
            return {}
        user = r.json()["result"][0]
        solved, tags = set(), {}
        if sub_r.status_code == 200 and sub_r.json().get("status") == "OK":
            for sub in sub_r.json()["result"]:
                if sub.get("verdict") == "OK":
                    pid = f"{sub['problem'].get('contestId')}-{sub['problem'].get('index')}"
                    solved.add(pid)
                    for tag in sub["problem"].get("tags", []):
                        tags[tag] = tags.get(tag, 0) + 1
        top_tags = sorted(tags, key=tags.get, reverse=True)[:6]
        return {
            "rating": user.get("rating", 0),
            "maxRating": user.get("maxRating", 0),
            "rank": user.get("rank", "unrated"),
            "solvedCount": len(solved),
            "topTags": top_tags,
            "tagCounts": {t: tags[t] for t in top_tags},
        }
    except:
        return {}

# ── Plotly theme helper ───────────────────────────────────────────────────────
DARK = dict(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font_color="#94a3b8", margin=dict(l=10, r=10, t=30, b=10))

def gauge(value, title, color="#6366f1"):
    fig = go.Figure(go.Indicator(
        mode="gauge+number", value=value,
        title={"text": title, "font": {"color": "#94a3b8", "size": 13}},
        number={"font": {"color": "white", "size": 28}},
        gauge={
            "axis": {"range": [0, 100], "tickcolor": "#334155"},
            "bar": {"color": color},
            "bgcolor": "#1e293b",
            "bordercolor": "#334155",
            "steps": [{"range": [0, 40], "color": "#1e293b"}, {"range": [40, 70], "color": "#1e2a3a"}, {"range": [70, 100], "color": "#1e3040"}],
            "threshold": {"line": {"color": color, "width": 3}, "thickness": 0.8, "value": value},
        }
    ))
    fig.update_layout(**DARK, height=200)
    return fig

def radar_chart(categories, values, title):
    fig = go.Figure(go.Scatterpolar(
        r=values + [values[0]], theta=categories + [categories[0]],
        fill="toself", fillcolor="rgba(99,102,241,0.2)",
        line=dict(color="#6366f1", width=2),
        marker=dict(color="#06b6d4", size=6),
    ))
    fig.update_layout(**DARK, polar=dict(
        bgcolor="rgba(30,41,59,0.5)",
        radialaxis=dict(visible=True, range=[0, 100], tickfont=dict(color="#475569"), gridcolor="#1e293b"),
        angularaxis=dict(tickfont=dict(color="#94a3b8"), gridcolor="#1e293b"),
    ), title=dict(text=title, font=dict(color="#94a3b8", size=13)), height=320)
    return fig

def bar_chart(labels, values, title, color_scale=None):
    colors = color_scale or ["#6366f1"] * len(values)
    fig = go.Figure(go.Bar(x=labels, y=values, marker_color=colors, text=values, textposition="outside",
                           textfont=dict(color="white")))
    fig.update_layout(**DARK, title=dict(text=title, font=dict(color="#94a3b8", size=13)),
                      xaxis=dict(tickfont=dict(color="#94a3b8"), gridcolor="#1e293b"),
                      yaxis=dict(tickfont=dict(color="#94a3b8"), gridcolor="#1e293b", range=[0, 110]),
                      height=300)
    return fig

def pie_chart(labels, values, title):
    fig = go.Figure(go.Pie(labels=labels, values=values, hole=0.5,
                           marker=dict(colors=["#6366f1", "#f59e0b", "#ef4444", "#06b6d4", "#10b981"]),
                           textfont=dict(color="white")))
    fig.update_layout(**DARK, title=dict(text=title, font=dict(color="#94a3b8", size=13)), height=300,
                      legend=dict(font=dict(color="#94a3b8")))
    return fig

# ── Main ──────────────────────────────────────────────────────────────────────
st.markdown("<h1 style='color:white;font-size:2rem;font-weight:800;'>⚡ Proof-of-Skill Engine</h1>", unsafe_allow_html=True)
st.markdown("<p style='color:#64748b;'>AI-powered candidate analysis · Beyond the resume</p>", unsafe_allow_html=True)
st.markdown("---")

if not analyze_btn:
    st.markdown("""
    <div style='text-align:center;padding:60px 0;color:#475569;'>
      <div style='font-size:3rem;'>⚡</div>
      <div style='font-size:1.2rem;margin-top:12px;'>Fill in the sidebar and click <b style='color:#6366f1'>Analyze Candidate</b></div>
      <div style='font-size:0.9rem;margin-top:8px;'>Supports GitHub · Codeforces · Resume PDF/DOCX</div>
    </div>
    """, unsafe_allow_html=True)
    st.stop()

# Fetch external data
gh_data, cf_data = {}, {}
with st.spinner("Fetching GitHub data..."):
    if github_user:
        gh_data = get_github(github_user)
with st.spinner("Fetching Codeforces data..."):
    if cf_handle:
        cf_data = get_cf(cf_handle)

# Call backend
with st.spinner("Running Gemini AI analysis..."):
    files = {}
    if resume_file:
        files["resume"] = (resume_file.name, resume_file.getvalue(), resume_file.type)
    payload = {
        "job_description": job_desc,
        "github_data": json.dumps(gh_data),
        "cf_data": json.dumps(cf_data),
    }
    try:
        resp = requests.post(f"{BACKEND}/analyze", data=payload, files=files if files else None, timeout=60)
        data = resp.json()
    except Exception as e:
        st.error(f"Backend error: {e}. Make sure the FastAPI server is running on port 8000.")
        st.stop()

# ── Tabs: Candidate View | Hirer View ────────────────────────────────────────
tab_candidate, tab_hirer = st.tabs(["👤 Candidate View", "🏢 Hirer View"])

# ════════════════════════════════════════════════════════════════════════════
# CANDIDATE VIEW
# ════════════════════════════════════════════════════════════════════════════
with tab_candidate:
    # Top metrics row
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f"""<div class='metric-card'>
          <div class='score-big'>{data.get('score', 0)}</div>
          <div style='color:#94a3b8;font-size:0.8rem;'>Match Score</div>
          <div style='color:#6366f1;font-weight:600;margin-top:4px;'>{data.get('label','')}</div>
        </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown(f"""<div class='metric-card'>
          <div class='score-big' style='font-size:2rem;'>{data.get('experience_years', '?')}</div>
          <div style='color:#94a3b8;font-size:0.8rem;'>Years Experience</div>
          <div style='color:#06b6d4;font-weight:600;margin-top:4px;'>{data.get('education','N/A')}</div>
        </div>""", unsafe_allow_html=True)
    with c3:
        st.markdown(f"""<div class='metric-card'>
          <div class='score-big' style='font-size:2rem;'>{cf_data.get('rating', gh_data.get('repos','—'))}</div>
          <div style='color:#94a3b8;font-size:0.8rem;'>{'CF Rating' if cf_data else 'GitHub Repos'}</div>
          <div style='color:#10b981;font-weight:600;margin-top:4px;'>{cf_data.get('rank', gh_data.get('summary',''))[:20]}</div>
        </div>""", unsafe_allow_html=True)
    with c4:
        verified_count = len(data.get('skills', {}).get('verified', []))
        total_skills = sum(len(v) for v in data.get('skills', {}).values())
        st.markdown(f"""<div class='metric-card'>
          <div class='score-big' style='font-size:2rem;'>{verified_count}/{total_skills}</div>
          <div style='color:#94a3b8;font-size:0.8rem;'>Skills Verified</div>
          <div style='color:#f59e0b;font-weight:600;margin-top:4px;'>{data.get('learningPrediction','')[:30]}</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Match breakdown radar + skill scores bar
    col_left, col_right = st.columns(2)
    with col_left:
        mb = data.get("match_breakdown", {})
        if mb:
            cats = list(mb.keys())
            vals = list(mb.values())
            cats_clean = [c.replace("_", " ").title() for c in cats]
            st.plotly_chart(radar_chart(cats_clean, vals, "Match Breakdown"), use_container_width=True)

    with col_right:
        ss = data.get("skill_scores", {})
        if ss:
            skills_sorted = sorted(ss.items(), key=lambda x: x[1], reverse=True)[:10]
            labels = [s[0] for s in skills_sorted]
            values = [s[1] for s in skills_sorted]
            colors = ["#10b981" if v >= 70 else "#f59e0b" if v >= 40 else "#ef4444" for v in values]
            st.plotly_chart(bar_chart(labels, values, "Skill Confidence Scores", colors), use_container_width=True)

    # Skill breakdown badges
    st.markdown("<div class='section-title'>Skill Breakdown</div>", unsafe_allow_html=True)
    sc1, sc2, sc3 = st.columns(3)
    with sc1:
        st.markdown("**✅ Verified**")
        badges = " ".join(f"<span class='badge-green'>{s}</span>" for s in data.get('skills', {}).get('verified', []))
        st.markdown(badges or "<span style='color:#475569'>None</span>", unsafe_allow_html=True)
    with sc2:
        st.markdown("**⚡ Learnable**")
        badges = " ".join(f"<span class='badge-yellow'>{s}</span>" for s in data.get('skills', {}).get('learnable', []))
        st.markdown(badges or "<span style='color:#475569'>None</span>", unsafe_allow_html=True)
    with sc3:
        st.markdown("**❌ Missing**")
        badges = " ".join(f"<span class='badge-red'>{s}</span>" for s in data.get('skills', {}).get('missing', []))
        st.markdown(badges or "<span style='color:#475569'>None</span>", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Resume skill verification
    if data.get("resume_skills"):
        st.markdown("<div class='section-title'>Resume Skill Verification</div>", unsafe_allow_html=True)
        rv1, rv2 = st.columns(2)
        with rv1:
            st.markdown("**🔍 Backed by Evidence**")
            badges = " ".join(f"<span class='badge-green'>{s}</span>" for s in data.get('resume_verified', []))
            st.markdown(badges or "<span style='color:#475569'>None</span>", unsafe_allow_html=True)
        with rv2:
            st.markdown("**⚠️ Claimed but Unverified**")
            badges = " ".join(f"<span class='badge-red'>{s}</span>" for s in data.get('resume_unverified', []))
            st.markdown(badges or "<span style='color:#475569'>None</span>", unsafe_allow_html=True)

        # Pie: verified vs unverified resume skills
        verified_n = len(data.get('resume_verified', []))
        unverified_n = len(data.get('resume_unverified', []))
        if verified_n + unverified_n > 0:
            st.plotly_chart(pie_chart(
                ["Verified by Evidence", "Claimed Only"],
                [verified_n, unverified_n],
                "Resume Skill Credibility"
            ), use_container_width=True)

    # GitHub language distribution
    if gh_data.get("languages"):
        lang_counts = {l: (i + 1) for i, l in enumerate(reversed(gh_data["languages"]))}
        st.plotly_chart(pie_chart(
            list(lang_counts.keys()), list(lang_counts.values()), "GitHub Language Distribution"
        ), use_container_width=True)

    # Codeforces topic breakdown
    if cf_data.get("tagCounts"):
        tags = cf_data["tagCounts"]
        st.plotly_chart(bar_chart(
            list(tags.keys()), list(tags.values()),
            "Codeforces — Problems Solved by Topic",
            ["#6366f1"] * len(tags)
        ), use_container_width=True)

    # Strengths & Gaps
    sg1, sg2 = st.columns(2)
    with sg1:
        st.markdown("<div class='section-title'>Strengths</div>", unsafe_allow_html=True)
        for s in data.get("candidate_strengths", []):
            st.markdown(f"<div class='success-box'>✅ {s}</div>", unsafe_allow_html=True)
    with sg2:
        st.markdown("<div class='section-title'>Gaps to Address</div>", unsafe_allow_html=True)
        for g in data.get("candidate_gaps", []):
            st.markdown(f"<div class='warn-box'>⚡ {g}</div>", unsafe_allow_html=True)

    # AI Insight
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>AI Insight</div>", unsafe_allow_html=True)
    st.markdown(f"<div class='insight-box'>{data.get('aiInsight','')}</div>", unsafe_allow_html=True)
    st.markdown(f"<div class='warn-box'>⏱ {data.get('learningPrediction','')}</div>", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════════════
# HIRER VIEW
# ════════════════════════════════════════════════════════════════════════════
with tab_hirer:
    # Recommendation banner
    rec = data.get("hirer_recommendation", "")
    rec_color = "success-box" if "Hire" in rec else "warn-box" if "Consider" in rec else "danger-box"
    st.markdown(f"<div class='{rec_color}'><b>🏢 Hiring Recommendation:</b> {rec}</div>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)

    # 4 fit gauges
    mb = data.get("match_breakdown", {})
    if mb:
        g1, g2, g3, g4 = st.columns(4)
        gauge_colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"]
        for col, (key, color) in zip([g1, g2, g3, g4], zip(mb.keys(), gauge_colors)):
            with col:
                st.plotly_chart(gauge(mb[key], key.replace("_", " ").title(), color), use_container_width=True)

    # Overall score vs fit dimensions bar
    all_scores = {"Overall Match": data.get("score", 0), **mb}
    st.plotly_chart(bar_chart(
        [k.replace("_", " ").title() for k in all_scores.keys()],
        list(all_scores.values()),
        "Candidate Fit Overview",
        ["#6366f1" if v >= 70 else "#f59e0b" if v >= 40 else "#ef4444" for v in all_scores.values()]
    ), use_container_width=True)

    # Skills summary table
    st.markdown("<div class='section-title'>Skills Summary</div>", unsafe_allow_html=True)
    ss = data.get("skill_scores", {})
    if ss:
        df = pd.DataFrame([
            {
                "Skill": skill,
                "Confidence": score,
                "Status": "✅ Verified" if skill in data.get("skills", {}).get("verified", [])
                          else "⚡ Learnable" if skill in data.get("skills", {}).get("learnable", [])
                          else "❌ Missing",
                "In Resume": "Yes" if skill in data.get("resume_skills", []) else "No",
                "Evidence Backed": "Yes" if skill in data.get("resume_verified", []) else "No",
            }
            for skill, score in sorted(ss.items(), key=lambda x: x[1], reverse=True)
        ])
        st.dataframe(df, use_container_width=True, hide_index=True)

    # Resume credibility warning
    unverified = data.get("resume_unverified", [])
    if unverified:
        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown("<div class='section-title'>⚠️ Resume Credibility Alert</div>", unsafe_allow_html=True)
        st.markdown(f"""<div class='danger-box'>
          The following skills are <b>claimed on the resume but have no backing evidence</b> in GitHub or Codeforces.
          Consider probing these in the interview:<br><br>
          {" ".join(f"<span class='badge-red'>{s}</span>" for s in unverified)}
        </div>""", unsafe_allow_html=True)

    # Interview questions
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>🎯 Suggested Interview Questions</div>", unsafe_allow_html=True)
    for i, q in enumerate(data.get("interview_questions", []), 1):
        st.markdown(f"<div class='insight-box'><b>Q{i}.</b> {q}</div>", unsafe_allow_html=True)

    # Candidate profile summary
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Candidate Profile Summary</div>", unsafe_allow_html=True)
    p1, p2 = st.columns(2)
    with p1:
        if gh_data:
            st.markdown(f"""<div class='insight-box'>
              <b>GitHub</b><br>
              📦 {gh_data.get('repos',0)} public repos<br>
              💻 {', '.join(gh_data.get('languages',[]))}<br>
              👥 {gh_data.get('followers',0)} followers
            </div>""", unsafe_allow_html=True)
    with p2:
        if cf_data:
            st.markdown(f"""<div class='insight-box'>
              <b>Codeforces</b><br>
              ⭐ Rating: {cf_data.get('rating',0)} (max {cf_data.get('maxRating',0)})<br>
              🏅 Rank: {cf_data.get('rank','unrated')}<br>
              ✅ {cf_data.get('solvedCount',0)} problems solved
            </div>""", unsafe_allow_html=True)
