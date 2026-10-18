# Import M3U

## UI (Retro)
1. Open ✎ on the TV control bar
2. Tab **Nhập M3U**
3. URL **or** paste **or** file → **Xem trước** → **Nhập vào kho**
4. **Nạp thư viện vào TV**

## API
```bash
# Preview
curl -X POST http://127.0.0.1:8080/api/library/import \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://iptv-org.github.io/iptv/countries/vn.m3u","dryRun":true}'

# Import (localhost or X-Admin-Token)
curl -X POST http://127.0.0.1:8080/api/library/import \
  -H 'Content-Type: application/json' \
  -d '{"text":"#EXTM3U\n...","dryRun":false,"mode":"merge"}'
```

## AI
- “Cho tôi kênh Việt Nam” → `find_sources` + `import_source` dryRun
- “Xác nhận nhập” → `import_source` confirm
