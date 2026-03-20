import os, json, re
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pymupdf
import docx
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash-001"]


def extract_text(file: UploadFile) -> str:
    data = file.file.read()
    if file.filename.endswith(".pdf"):
        doc = pymupdf.open(stream=data, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    elif file.filename.endswith(".docx"):
        import io
        d = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in d.paragraphs)
    return data.decode("utf-8", errors="ignore")


def call_gemini(prompt: str) -> dict:
    last_err = None
    for model_name in MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            text = resp.text.strip()
            clean = re.sub(r"^```json\n?|^```\n?|\n?```$", "", text, flags=re.MULTILINE).strip()
            return json.loads(clean)
        except Exception as e:
            last_err = e
            if "429" not in str(e) and "404" not in str(e):
                raise
    raise last_err


@app.post("/analyze")
async def analyze(
    job_description: str = Form(...),
    github_data: str = Form("{}"),
    cf_data: str = Form("{}"),
    resume: UploadFile = File(None),
):
    resume_text = ""
    if resume and resume.filename:
        resume_text = extract_text(resume)

    gh = json.loads(github_data)
    cf = json.loads(cf_data)

    prompt = f"""
You are an expert AI hiring analyst. Analyze the candidate thoroughly and return ONLY a valid JSON object.

## Resume Text
{resume_text or "Not provided"}

## GitHub Profile
{json.dumps(gh, indent=2) if gh else "Not provided"}

## Codeforces Profile
{json.dumps(cf, indent=2) if cf else "Not provided"}

## Job Description
{job_description}

## Instructions
Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{{
  "score": <0-100>,
  "label": <"Strong Match"|"Good Match"|"Partial Match"|"Weak Match">,
  "skills": {{
    "verified": [<skills proven by resume/github/cf>],
    "learnable": [<skills candidate can pick up quickly>],
    "missing": [<skills required but no evidence>]
  }},
  "resume_skills": [<all skills extracted from resume>],
  "resume_verified": [<resume skills that are actually backed by github/cf evidence>],
  "resume_unverified": [<resume skills with NO github/cf backing — potential bluffing>],
  "skill_scores": {{<skill_name>: <0-100 confidence score>}},
  "experience_years": <estimated years from resume or 0>,
  "education": "<highest degree or N/A>",
  "learningPrediction": "<e.g. Estimated time to become job-ready: 2-4 weeks>",
  "aiInsight": "<3-4 sentence detailed explanation>",
  "candidate_strengths": [<3-5 key strengths>],
  "candidate_gaps": [<3-5 key gaps>],
  "hirer_recommendation": "<Hire|Strong Hire|Consider|Reject> with 2 sentence reason",
  "interview_questions": [<5 targeted technical questions based on gaps>],
  "match_breakdown": {{
    "technical_fit": <0-100>,
    "experience_fit": <0-100>,
    "problem_solving": <0-100>,
    "learning_potential": <0-100>
  }}
}}
"""
    result = call_gemini(prompt)
    return JSONResponse(result)
