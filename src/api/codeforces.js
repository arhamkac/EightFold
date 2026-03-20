import CryptoJS from "crypto-js";

const API_KEY = import.meta.env.VITE_CF_API_KEY;
const API_SECRET = import.meta.env.VITE_CF_API_SECRET;

function buildSignedUrl(method, params) {
  const rand = Math.floor(Math.random() * 900000) + 100000;
  const time = Math.floor(Date.now() / 1000);
  const allParams = { ...params, apiKey: API_KEY, time };
  const sorted = Object.keys(allParams).sort().map(k => `${k}=${allParams[k]}`).join("&");
  const toHash = `${rand}/${method}?${sorted}#${API_SECRET}`;
  const hash = CryptoJS.SHA512(toHash).toString();
  return `https://codeforces.com/api/${method}?${sorted}&apiSig=${rand}${hash}`;
}

export async function fetchCodeforcesData(handle) {
  // Public user info doesn't require signing
  const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
  if (!infoRes.ok) throw new Error(`Codeforces handle "${handle}" not found`);
  const infoData = await infoRes.json();
  if (infoData.status !== "OK") throw new Error(infoData.comment || "Codeforces error");

  const user = infoData.result[0];

  // Fetch recent submissions for problem-solving stats
  const subRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100`);
  const subData = await subRes.json();

  const solved = new Set();
  const tags = {};
  if (subData.status === "OK") {
    for (const sub of subData.result) {
      if (sub.verdict === "OK") {
        solved.add(`${sub.problem.contestId}-${sub.problem.index}`);
        for (const tag of (sub.problem.tags || [])) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      }
    }
  }

  const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  return {
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    rank: user.rank || "unrated",
    solvedCount: solved.size,
    topTags,
  };
}
