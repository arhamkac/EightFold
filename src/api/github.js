const BASE = "https://api.github.com";
const headers = import.meta.env.VITE_GITHUB_TOKEN
  ? { Authorization: `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}` }
  : {};

export async function fetchGitHubData(username) {
  const [userRes, reposRes] = await Promise.all([
    fetch(`${BASE}/users/${username}`, { headers }),
    fetch(`${BASE}/users/${username}/repos?per_page=100&sort=updated`, { headers }),
  ]);

  if (!userRes.ok) throw new Error(`GitHub user "${username}" not found`);

  const user = await userRes.json();
  const repos = await reposRes.json();

  const langCount = {};
  for (const repo of repos) {
    if (repo.language) langCount[repo.language] = (langCount[repo.language] || 0) + 1;
  }
  const languages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  return {
    repos: user.public_repos,
    languages,
    summary: `${user.public_repos} repos · ${languages.join(", ")}`,
    bio: user.bio || "",
    topRepos: repos.slice(0, 5).map(r => ({ name: r.name, stars: r.stargazers_count, lang: r.language })),
  };
}
