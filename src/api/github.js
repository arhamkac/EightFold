const BASE = "https://api.github.com";
const token = import.meta.env.VITE_GITHUB_TOKEN;
const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

async function ghFetch(url, useAuth = true) {
  const res = await fetch(url, { headers: useAuth ? authHeaders : {} });
  if (res.status === 401 && useAuth) return ghFetch(url, false);
  return res;
}

export async function fetchGitHubData(username) {
  const [userRes, reposRes] = await Promise.all([
    ghFetch(`${BASE}/users/${username}`),
    ghFetch(`${BASE}/users/${username}/repos?per_page=100&sort=updated`),
  ]);

  if (!userRes.ok) throw new Error(`GitHub user "${username}" not found`);

  const user = await userRes.json();
  const repos = await reposRes.json();

  // Language frequency by repo count
  const langCount = {};
  for (const repo of repos) {
    if (repo.language) langCount[repo.language] = (langCount[repo.language] || 0) + 1;
  }
  const languageData = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([lang, count]) => ({ lang, count }));

  const languages = languageData.map(l => l.lang);

  // Top repos by stars
  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6)
    .map(r => ({
      name: r.name,
      stars: r.stargazers_count,
      forks: r.forks_count,
      lang: r.language,
      description: r.description || "",
      url: r.html_url,
      updatedAt: r.updated_at,
    }));

  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
  const hasReadme = repos.filter(r => r.has_wiki || r.description).length;

  return {
    repos: user.public_repos,
    followers: user.followers,
    following: user.following,
    accountAgeDays: Math.floor((Date.now() - new Date(user.created_at)) / 86400000),
    languages,
    languageData,
    totalStars,
    totalForks,
    hasReadme,
    summary: `${user.public_repos} repos · ${languages.slice(0, 3).join(", ")}`,
    bio: user.bio || "",
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
    topRepos,
  };
}
