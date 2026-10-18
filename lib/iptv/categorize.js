/**
 * Prefer iptv-org categories; light map to display group. No channel-name regex.
 */
const MAP = {
  news: 'News',
  sports: 'Sports',
  animation: 'Kids',
  kids: 'Kids',
  movie: 'Movies',
  movies: 'Movies',
  music: 'Music',
  entertainment: 'Entertainment',
  documentary: 'Documentary',
  education: 'Education',
  culture: 'Culture',
  cooking: 'Lifestyle',
  lifestyle: 'Lifestyle',
  shop: 'Shop',
  outdoor: 'Outdoor',
  series: 'Series',
  general: 'General'
};

function groupFromCategories(categories) {
  if (!categories || !categories.length) return 'General';
  const parts = categories.map(c => MAP[String(c).toLowerCase()] || String(c)).filter(Boolean);
  // unique
  return [...new Set(parts)].join(';') || 'General';
}

function applyAutoCategories(list) {
  return (list || []).map(ch => {
    if (ch.categories && ch.categories.length) {
      return { ...ch, group: groupFromCategories(ch.categories) };
    }
    // keep existing group from M3U group-title; else General
    return { ...ch, group: ch.group || 'General' };
  });
}

module.exports = { applyAutoCategories, groupFromCategories };
