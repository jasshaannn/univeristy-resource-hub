// Protects admin write & management routes.
// Supports:
// 1. Bearer session tokens (from ID/password login)
// 2. x-admin-token header
// 3. x-admin-key header (for scripts and automated tools)
const crypto = require('crypto');

let fallbackSecret = null;
function getSecretKey() {
  if (process.env.ADMIN_KEY && process.env.ADMIN_KEY.trim()) {
    return process.env.ADMIN_KEY.trim();
  }
  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[SECURITY NOTICE] ADMIN_KEY not defined in .env. Generated temporary cryptographically secure session key.');
  }
  return fallbackSecret;
}

function safeEqual(a, b) {
  if (typeof a !== 'string') a = String(a || '');
  if (typeof b !== 'string') b = String(b || '');
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Generates a tamper-proof HMAC-SHA256 session token
function createAdminToken(payload = {}) {
  const secret = getSecretKey();
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days expiration
  };
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${hmac}`;
}

// Verifies token signature and checks expiration
function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [b64, signature] = parts;
  const secret = getSecretKey();
  const expectedSig = crypto.createHmac('sha256', secret).update(b64).digest('base64url');

  if (!safeEqual(signature, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  // 1. Check Authorization header: Bearer <token>
  const authHeader = req.get('authorization') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.get('x-admin-token')) {
    token = req.get('x-admin-token');
  }

  if (token) {
    const payload = verifyAdminToken(token);
    if (payload) {
      req.admin = payload;
      return next();
    }
  }

  // 2. Fallback to direct x-admin-key header
  const expectedKey = process.env.ADMIN_KEY;
  const givenKey = req.get('x-admin-key') || '';
  if (expectedKey && safeEqual(givenKey, expectedKey)) {
    req.admin = { id: process.env.ADMIN_ID || 'admin', viaKey: true };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
}

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.createAdminToken = createAdminToken;
module.exports.verifyAdminToken = verifyAdminToken;
module.exports.safeEqual = safeEqual;
