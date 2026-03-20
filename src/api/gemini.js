import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash-001"];

export async function analyzeWithGemini({ githubData, cfData, jobDescription }) {
  let lastError;
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(buildPrompt(githubData, cfData, jobDescription));
      const text = result.response.text().trim();
      const clean = text.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
      return JSON.parse(clean);
    } catch (e) {
      lastError = e;
      if (!e.message?.includes("429") && !e.message?.includes("404")) throw e;
    }
  }
  throw lastError;
}

function buildPrompt(githubData, cfData, jobDescription) {
  return `
You are an expert technical hiring assistant. Perform a deep analysis of this candidate against the job description.

## Candidate GitHub Profile
- Public repos: ${githubData.repos}
- Account age: ${githubData.accountAgeDays} days
- Total stars earned: ${githubData.totalStars}
- Total forks: ${githubData.totalForks}
- Followers: ${githubData.followers}
- Languages (by repo count): ${githubData.languageData.map(l => `${l.lang}(${l.count})`).join(", ")}
- Bio: ${githubData.bio || "N/A"}
- Top repos: ${githubData.topRepos.map(r => `${r.name}[${r.lang}, ⭐${r.stars}, 🍴${r.forks}]: ${r.description}`).join(" | ")}

## Candidate Codeforces Profile
- Current rating: ${cfData.rating} (max: ${cfData.maxRating})
- Rank: ${cfData.rank} (max: ${cfData.maxRank})
- Problems solved: ${cfData.solvedCount}
- Total submissions: ${cfData.totalSubmissions}
- Acceptance rate: ${cfData.acceptanceRate}%
- Top problem tags: ${cfData.tagData.map(t => `${t.tag}(${t.count})`).join(", ")}
- Contribution: ${cfData.contribution}

## Job Description
${jobDescription}

## Instructions
Extract every distinct skill/technology/requirement from the job description. For each one, compute a cosine similarity score (0.0–1.0) representing how strongly the candidate's evidence matches that requirement.

Return ONLY a valid JSON object with this exact shape:
{
  "score": <overall 0-100>,
  "label": <"Strong Match" | "Good Match" | "Partial Match" | "Weak Match">,
  "skillSimilarity": [
    { "skill": "<skill name>", "score": <0.0-1.0>, "status": <"verified"|"learnable"|"missing">, "evidence": "<one line of evidence from their profile>" }
  ],
  "dimensions": {
    "githubActivity": { "score": <0-100>, "summary": "<one line>" },
    "dsaStrength": { "score": <0-100>, "summary": "<one line>" },
    "stackFit": { "score": <0-100>, "summary": "<one line>" },
    "projectDepth": { "score": <0-100>, "summary": "<one line>" },
    "experienceProxy": { "score": <0-100>, "summary": "<one line>" }
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "redFlags": ["<red flag if any, else empty array>"],
  "hiringRecommendation": <"Strong Hire" | "Hire" | "Maybe" | "No Hire">,
  "learningPrediction": "<e.g. Estimated time to become job-ready: 2–4 weeks>",
  "aiInsight": "<3-4 sentence detailed explanation covering strengths, gaps, and hiring rationale>"
}
`;
}
