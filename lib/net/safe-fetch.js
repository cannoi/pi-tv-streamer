/**
 * SSRF-safe fetch with DNS resolution + IP pin (anti-rebinding).
 */
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

function isBlockedIp(ip) {
  if (!ip) return true;
  const v = String(ip).toLowerCase();
  // IPv4-mapped IPv6
  if (v.startsWith('::ffff:')) return isBlockedIp(v.slice(7));
  if (net.isIPv4(v)) {
    const p = v.split('.').map(Number);
    const n = ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true; // benchmark
    if (p[0] >= 224) return true; // multicast/reserved
    return false;
  }
  if (net.isIPv6(v)) {
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // ULA
    if (v.startsWith('fe80')) return true;
    if (v.startsWith('ff')) return true; // multicast
    return false;
  }
  return true;
}

async function resolvePublic(hostname) {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('blocked_ip');
    return [hostname];
  }
  const r = await dns.lookup(hostname, { all: true, verbatim: true });
  const ips = (r || []).map(x => x.address).filter(Boolean);
  if (!ips.length) throw new Error('dns_failed');
  for (const ip of ips) {
    if (isBlockedIp(ip)) throw new Error('blocked_ip');
  }
  return ips;
}

async function assertSafeUrl(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { throw new Error('invalid_url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol_not_allowed');
  if (u.username || u.password) throw new Error('userinfo_not_allowed');
  await resolvePublic(u.hostname);
  return u;
}

function requestPinned(urlObj, ip, { method = 'GET', headers = {}, timeoutMs, signal } = {}) {
  const lib = urlObj.protocol === 'https:' ? https : http;
  const opts = {
    protocol: urlObj.protocol,
    hostname: ip, // connect to resolved IP
    servername: urlObj.hostname, // TLS SNI / Host
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method,
    headers: { ...headers, Host: urlObj.host },
    timeout: timeoutMs,
    setHost: false
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(opts, (res) => {
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > (opts._maxBytes || DEFAULT_MAX_BYTES)) {
          req.destroy();
          reject(new Error('body_too_large'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          buffer: Buffer.concat(chunks)
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (signal) {
      if (signal.aborted) { req.destroy(); reject(new Error('timeout')); }
      else signal.addEventListener('abort', () => { req.destroy(); reject(new Error('timeout')); });
    }
    req.end();
  });
}

async function safeFetch(urlStr, {
  method = 'GET',
  headers = {},
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  redirect = 'manual'
} = {}) {
  let current = String(urlStr);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const u = await assertSafeUrl(current);
    const ips = await resolvePublic(u.hostname);
    const ip = ips[0];
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const resp = await requestPinned(u, ip, {
        method,
        headers: { 'User-Agent': 'PiVintageTV/1.9', ...headers },
        timeoutMs,
        signal: ac.signal
      });
      // attach maxBytes into request via closure already checked in data handler — re-check
      if (resp.buffer.length > maxBytes) throw new Error('body_too_large');
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const loc = resp.headers.location;
        if (!loc) throw new Error('redirect_without_location');
        current = new URL(loc, current).href;
        // re-validate next hop
        await assertSafeUrl(current);
        continue;
      }
      return {
        response: {
          ok: resp.status >= 200 && resp.status < 300,
          status: resp.status,
          headers: {
            get(name) {
              const v = resp.headers[String(name).toLowerCase()];
              return Array.isArray(v) ? v[0] : v;
            }
          }
        },
        buffer: resp.buffer,
        finalUrl: current
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('too_many_redirects');
}

module.exports = { safeFetch, assertSafeUrl, isBlockedIp, resolvePublic };
