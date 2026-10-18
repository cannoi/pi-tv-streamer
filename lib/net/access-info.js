/**
 * Public access URL for SoloHost / remote QR
 */
function getAccessInfo(req) {
  const port = process.env.PORT || '8080';
  const envUrl = process.env.SOLOHOST_PUBLIC_URL || process.env.PUBLIC_URL || process.env.APP_PUBLIC_URL || '';
  let publicUrl = String(envUrl || '').replace(/\/$/, '');

  if (!publicUrl) {
    // Prefer forwarded host (SoloHost reverse proxy)
    const xfHost = req.get('x-forwarded-host') || req.get('host');
    const xfProto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    if (xfHost) publicUrl = xfProto + '://' + xfHost.split(',')[0].trim();
  }

  // Optional explicit public IP
  const publicIp = process.env.PUBLIC_IP || process.env.SOLOHOST_PUBLIC_IP || '';
  if (!publicUrl && publicIp) {
    publicUrl = 'http://' + publicIp + (String(port) === '80' ? '' : ':' + port);
  }

  const localUrl = 'http://127.0.0.1:' + port;
  return {
    publicUrl: publicUrl || localUrl,
    localUrl,
    port: Number(port),
    hasConfiguredPublic: !!(envUrl || publicIp)
  };
}

module.exports = { getAccessInfo };
