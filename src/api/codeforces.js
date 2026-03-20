export async function fetchCodeforcesData(handle) {
  const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
  if (!infoRes.ok) throw new Error(`Codeforces handle "${handle}" not found`);
  const infoData = await infoRes.json();
  if (infoData.status !== "OK") throw new Error(infoData.comment || "Codeforces error");

  const user = infoData.result[0];

  // Fetch ALL submissions (up to 500 for richer stats)
  const [subRes, ratingRes] = await Promise.all([
    fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=500`),
    fetch(`https://codeforces.com/api/user.ratingChanges?handle=${handle}`),
  ]);

  const subData = await subRes.json();
  const ratingText = await ratingRes.text();
  let ratingData = { status: "FAILED" };
  try { ratingData = JSON.parse(ratingText); } catch (_) {}

  const solved = new Set();
  const tags = {};
  let accepted = 0, wrongAnswer = 0, tle = 0;

  if (subData.status === "OK") {
    for (const sub of subData.result) {
      if (sub.verdict === "OK") {
        solved.add(`${sub.problem.contestId}-${sub.problem.index}`);
        accepted++;
        for (const tag of (sub.problem.tags || [])) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      } else if (sub.verdict === "WRONG_ANSWER") wrongAnswer++;
      else if (sub.verdict === "TIME_LIMIT_EXCEEDED") tle++;
    }
  }

  const tagData = Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const topTags = tagData.map(t => t.tag);

  // Rating history — last 20 contests
  const ratingHistory = ratingData.status === "OK"
    ? ratingData.result.slice(-20).map(r => ({
        contestName: r.contestName,
        rating: r.newRating,
        change: r.newRating - r.oldRating,
        date: new Date(r.ratingUpdateTimeSeconds * 1000).toLocaleDateString(),
      }))
    : [];

  const totalSubmissions = subData.status === "OK" ? subData.result.length : 0;
  const acceptanceRate = totalSubmissions > 0 ? Math.round((accepted / totalSubmissions) * 100) : 0;

  return {
    rating: user.rating || 0,
    maxRating: user.maxRating || 0,
    rank: user.rank || "unrated",
    maxRank: user.maxRank || "unrated",
    solvedCount: solved.size,
    totalSubmissions,
    acceptanceRate,
    topTags,
    tagData,
    ratingHistory,
    verdicts: { accepted, wrongAnswer, tle },
    contribution: user.contribution || 0,
  };
}
