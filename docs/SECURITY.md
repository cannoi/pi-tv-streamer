# Security notes
- ADMIN_TOKEN protects AI settings/logs when set; otherwise localhost-only (see admin-auth).
- HLS proxy: playlist entry requires library channel source OR valid HMAC (`exp`,`sig`).
- safe-fetch pins DNS IP to avoid rebinding; blocks private/link-local/CGNAT/multicast.
- Media files served only under MEDIA_ROOT via realpath.
- Set SOLOHOST_PUBLIC_URL for correct remote QR.
- ENABLE_GITHUB_SEARCH=1 to allow GitHub playlist search.
- ENABLE_FEEDBACK=1 + SHFH_* env to enable feedback hub (no defaults).
