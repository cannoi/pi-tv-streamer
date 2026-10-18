/**
 * SSRF-safe fetch: DNS resolve + block private/link-local, manual redirects, size limit.
 */
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

function ipv4ToInt(ip) {
  return ip.split('.').reduce((a, o) => ((a << 8) + Number(o)) >>> 0, 0);
}

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  if ((n >>> 24) === 10) return true; // 10.0.0.0/8
  if ((n >>> 20) === 0x0ac1) return true; // 172.16.0.0/12  (0xac1 = 172.16>>4? wait)
  // 172.16.0.0/12
  if ((n >>> 20) === ((172 << 4) | 1)) return true;
  if ((n >>> 16) === 0xc0a8) return true; // 192.168.0.0/16
  if ((n >>> 24) === 127) return true; // 127.0.0.0/8
  if ((n >>> 16) === 0xa9fe) return true; // 169.254.0.0/16
  if ((n >>> 22) === (100 << 2) + 1) return true; // 100.64.0.0/10 CGNAT approx
  // CGNAT 100.64.0.0/10
  if ((n >>> 22) === (100 * 4 + 1)) return true;
  if (ip === '0.0.0.0') return true;
  return false;
}

function isPrivateIPv4Fixed(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIPv6(ip) {
  const x = ip.toLowerCase();
  if (x === '::1' || x === '::') return true;
  if (x.startsWith('fc') || x.startsWith('fd')) return true; // ULA fc00::/7
  if (x.startsWith('fe80')) return true;
  if (x.startsWith('::ffff:')) {
    const v4 = x.slice(7);
    if (net.isIPv4(v4)) return isPrivateIPv4Fixed(v4);
  }
  return false;
}

function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4Fixed(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

async function assertSafeUrl(urlStr, { allowPorts } = {}) {
  let u;
  try { u = new URL(urlStr); } catch { throw new Error('invalid_url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol_not_allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw new Error('invalid_host');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('blocked_host');
  }
  const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
  if (allowPorts && allowPorts.length && !allowPorts.includes(port)) {
    throw new Error('port_not_allowed');
  }
  // Resolve DNS
  let addresses = [];
  try {
    if (net.isIP(host)) {
      addresses = [host];
    } else {
      const r = await dns.lookup(host, { all: true, verbatim: true });
      addresses = r.map(x => x.address);
    }
  } catch {
    throw new Error('dns_failed');
  }
  for (const ip of addresses) {
    if (isBlockedIp(ip)) throw new Error('blocked_ip:' + ip);
  }
  return { url: u, addresses };
}

async function safeFetch(urlStr, options = {}) {
  const {
    method = 'GET',
    headers = {},
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = MAX_REDIRECTS,
    body
  } = options;

  let current = urlStr;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(current, {
        method,
        headers: { 'User-Agent': 'PiVintageTV/1.8', ...headers },
        body,
        redirect: 'manual',
        signal: controller.signal
      });
      clearTimeout(timer);
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const loc = resp.headers.get('location');
        if (!loc) throw new Error('redirect_without_location');
        current = new URL(loc, current).href;
        continue;
      }
      const reader = resp.body;
      if (!reader) {
        return { response: resp, buffer: Buffer.alloc(0), finalUrl: current };
      }
      const chunks = [];
      let total = 0;
      for await (const chunk of reader) {
        total += chunk.length;
        if (total > maxBytes) throw new Error('body_too_large');
        chunks.push(chunk);
      }
      return {
        response: resp,
        buffer: Buffer.concat(chunks),
        text: () => Buffer.concat(chunks).toString('utf8'),
        finalUrl: current
      };
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('timeout');
      throw e;
    }
  }
  throw new Error('too_many_redirects');
}

module.exports = { safeFetch, assertSafeUrl, isBlockedIp, isPrivateIPv4Fixed };
