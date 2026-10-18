/**
 * Search public GitHub for M3U playlists. Results are suggestions only —
 * import still goes through safe-fetch + user/AI confirmation.
 */
const { safeFetch } = require("../net/safe-fetch");

async function searchGithubRepos(query, { token, limit = 8 } = {}) {
  const q = encodeURIComponent(String(query || "") + " m3u OR iptv OR playlist in:name,description");
  const url = "https://api.github.com/search/repositories?q=" + q + "&sort=updated&per_page=" + Math.min(limit, 10);
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PiVintageTV-PlaylistSearch/1.9"
  };
  if (token) headers.Authorization = "Bearer " + token;
  try {
    const { buffer, response } = await safeFetch(url, { headers, timeoutMs: 15000, maxBytes: 2 * 1024 * 1024 });
    if (!response.ok) return { ok: false, error: "github_" + response.status, items: [] };
    const data = JSON.parse(buffer.toString("utf8"));
    const items = (data.items || []).map(r => ({
      kind: "repo",
      name: r.name,
      repo: r.full_name,
      stars: r.stargazers_count,
      description: r.description || "",
      htmlUrl: r.html_url,
      url: "https://raw.githubusercontent.com/" + r.full_name + "/" + (r.default_branch || "main") + "/index.m3u",
      updated: r.updated_at
    }));
    return { ok: true, items, source: "repositories" };
  } catch (e) {
    return { ok: false, error: e.message, items: [] };
  }
}

async function searchGithubPlaylists(query, { token, limit = 8 } = {}) {
  const q = String(query || "").trim().slice(0, 80);
  if (!q) return { ok: false, error: "empty_query", items: [] };
  const codeQ = encodeURIComponent(q + " extension:m3u OR extension:m3u8");
  const url = "https://api.github.com/search/code?q=" + codeQ + "&per_page=" + Math.min(limit, 10);
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PiVintageTV-PlaylistSearch/1.9"
  };
  if (token) headers.Authorization = "Bearer " + token;
  try {
    const { buffer, response } = await safeFetch(url, { headers, timeoutMs: 15000, maxBytes: 2 * 1024 * 1024 });
    if (!response.ok || response.status === 401 || response.status === 403) {
      return searchGithubRepos(q, { token, limit });
    }
    const data = JSON.parse(buffer.toString("utf8"));
    const items = (data.items || []).map(it => {
      const htmlUrl = it.html_url || "";
      const raw = htmlUrl
        ? htmlUrl.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/blob/", "/")
        : null;
      return {
        kind: "file",
        name: it.name,
        path: it.path,
        repo: it.repository && it.repository.full_name,
        stars: it.repository && it.repository.stargazers_count,
        url: raw,
        htmlUrl,
        description: (it.repository && it.repository.description) || ""
      };
    }).filter(x => x.url);
    if (!items.length) return searchGithubRepos(q, { token, limit });
    return { ok: true, items, source: "code" };
  } catch (e) {
    return searchGithubRepos(q, { token, limit });
  }
}

module.exports = { searchGithubPlaylists, searchGithubRepos };
