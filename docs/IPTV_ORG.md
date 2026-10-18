# iptv-org integration

## Playlists (M3U)
- Countries: `https://iptv-org.github.io/iptv/countries/{code}.m3u`
- Categories: `https://iptv-org.github.io/iptv/categories/{name}.m3u`
- Languages: `https://iptv-org.github.io/iptv/languages/{code}.m3u`

## API JSON (enrichment)
Verified fields (2026):
- `channels.json`: `id`, `name`, `country`, `categories[]`, `is_nsfw`, `website`, `closed`
- `logos.json`: `channel`, `feed`, `in_use`, `url`
- `blocklist.json`: entries with `channel` / related ids

Cache: `data/iptv-org-cache/` TTL 24h via `lib/iptv/enrich.js`.

Match key: `tvg-id` → `channelKey` (part before `@`) → `channels[].id`.
