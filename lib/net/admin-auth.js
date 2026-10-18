/**
 * Admin gate helpers.
 * - If ADMIN_TOKEN is set: require header x-admin-token (or ?admin_token=)
 * - If unset: AI settings are open (so remote users can save API keys);
 *   destructive ops can still use adminAuthStrict for localhost-only.
 */
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function isLocalhost(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

function adminAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN || '';
  const provided = req.headers['x-admin-token'] || req.query.admin_token || '';
  if (token) {
    if (provided && provided === token) return next();
    return res.status(401).json({ ok: false, error: 'admin_required' });
  }
  // No ADMIN_TOKEN: allow (needed for SoloHost remote AI key setup)
  return next();
}

/** Stricter: localhost only when no token (for logs wipe etc.) */
function adminAuthStrict(req, res, next) {
  const token = process.env.ADMIN_TOKEN || '';
  const provided = req.headers['x-admin-token'] || req.query.admin_token || '';
  if (token) {
    if (provided && provided === token) return next();
    return res.status(401).json({ ok: false, error: 'admin_required' });
  }
  const ip = getClientIp(req);
  if (isLocalhost(ip)) return next();
  return res.status(401).json({ ok: false, error: 'admin_required_or_localhost' });
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: http: https:; connect-src 'self' http: https:;");
  next();
}

const hits = new Map();
function rateLimit(options = {}) {
  if (options && options.method && options.url !== undefined && typeof arguments[2] === 'function') {
    return rateLimit({})(options, arguments[1], arguments[2]);
  }
  const windowMs = options.windowMs || 60000;
  const max = options.max || 180;
  return (req, res, next) => {
    try {
      const ip = getClientIp(req) || 'unknown';
      const now = Date.now();
      let b = hits.get(ip);
      if (!b || now - b.t > windowMs) b = { t: now, n: 0 };
      b.n++;
      hits.set(ip, b);
      if (b.n > max) return res.status(429).json({ ok: false, error: 'rate_limited' });
    } catch (_) {}
    next();
  };
}

module.exports = { adminAuth, adminAuthStrict, securityHeaders, rateLimit, isLocalhost, getClientIp };
