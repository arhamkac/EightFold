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
You are an AI hiring assistant. Analyze this candidate's data against the job description and return a JSON object.

## Candidate Data
- GitHub: ${githubData.repos} public repos, languages: ${githubData.languages.join(", ")}
- GitHub bio: ${githubData.bio || "N/A"}
- Top repos: ${githubData.topRepos.map(r => `${r.name}(${r.lang}, ⭐${r.stars})`).join(", ")}
- Codeforces rating: ${cfData.rating} (max: ${cfData.maxRating}), rank: ${cfData.rank}
- Problems solved (last 100 submissions): ${cfData.solvedCount}
- Strong problem topics: ${cfData.topTags.join(", ")}

## Job Description
${jobDescription}

## Instructions
Return ONLY a valid JSON object (no markdown, no explanation) with this exact shape:
{
  "score": <number 0-100>,
  "label": <"Strong Match" | "Good Match" | "Partial Match" | "Weak Match">,
  "skills": {
    "verified": [<skills the candidate clearly has>],
    "learnable": [<skills they can pick up quickly given their background>],
    "missing": [<skills they lack with no evidence of proximity>]
  },
  "learningPrediction": "<e.g. Estimated time to become job-ready: 2–4 weeks>",
  "aiInsight": "<2-3 sentence explanation of why the candidate matches or doesn't>"
}
`;
}
