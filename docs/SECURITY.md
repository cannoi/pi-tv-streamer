# Security notes (v1.8.0)

## Rotate leaked credentials
If you used a zip before v1.8.0, **revoke** any Gemini API key and SHFH ingest token that may have been baked into `data/ai-settings.json` or `server.js`.

## Configuration
- `ADMIN_TOKEN` — required for library write, AI settings, logs (or localhost-only if unset)
- `SHFH_HUB_ID`, `SHFH_HUB_URL`, `SHFH_INGEST_TOKEN` — Feedback Hub (server-only)
- AI keys only in `data/ai-settings.json` (gitignored) via Settings UI

## SSRF
All outbound playlist/stream fetches go through `lib/net/safe-fetch.js` (DNS + private IP block + manual redirects).
