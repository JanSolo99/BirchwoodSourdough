const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory store for rate limiting (use Redis in production)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 30 * 60 * 1000; // 30 minutes

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://birchwood-sourdough.netlify.app'];

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

function getCORSHeaders(origin) {
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || 
    (process.env.NODE_ENV === 'development' && origin && origin.includes('localhost'));
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: now, lockedUntil: 0 };
  
  // Clean up old entries
  if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW && attempts.lockedUntil < now) {
    loginAttempts.delete(ip);
    return false;
  }
  
  // Check if still locked out
  if (attempts.lockedUntil > now) {
    return true;
  }
  
  // Check rate limit
  return attempts.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: now, lockedUntil: 0 };
  
  attempts.count++;
  attempts.lastAttempt = now;
  
  if (attempts.count >= MAX_ATTEMPTS) {
    attempts.lockedUntil = now + LOCKOUT_TIME;
  }
  
  loginAttempts.set(ip, attempts);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function logSecurityEvent(event, ip, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event} from ${ip}:`, details);
}

exports.handler = async (event, context) => {
  const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
  const origin = event.headers.origin;
  const headers = getCORSHeaders(origin);
  
  // Security checks
  if (!ADMIN_PASSWORD_HASH) {
    logSecurityEvent('MISSING_PASSWORD_HASH', clientIP);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Authentication service unavailable' })
    };
  }
  
  if (!JWT_SECRET) {
    logSecurityEvent('MISSING_JWT_SECRET', clientIP);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Authentication service unavailable' })
    };
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, password } = body;

    if (action === 'login') {
      // Check rate limiting
      if (isRateLimited(clientIP)) {
        logSecurityEvent('RATE_LIMITED_LOGIN', clientIP);
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({ error: 'Too many failed attempts. Please try again later.' })
        };
      }

      if (!password) {
        logSecurityEvent('LOGIN_NO_PASSWORD', clientIP);
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password is required' }) };
      }

      // Input validation
      if (typeof password !== 'string' || password.length > 1000) {
        logSecurityEvent('LOGIN_INVALID_INPUT', clientIP);
        recordFailedAttempt(clientIP);
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid input' }) };
      }

      if (hashPassword(password) === ADMIN_PASSWORD_HASH) {
        logSecurityEvent('LOGIN_SUCCESS', clientIP);
        clearAttempts(clientIP);
        const token = jwt.sign(
          { 
            user: 'admin', 
            iat: Math.floor(Date.now() / 1000),
            ip: clientIP 
          }, 
          JWT_SECRET, 
          { expiresIn: '2h' }
        );
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, token }),
        };
      } else {
        logSecurityEvent('LOGIN_FAILED', clientIP);
        recordFailedAttempt(clientIP);
        // Progressive delay based on attempt count
        const attempts = loginAttempts.get(clientIP) || { count: 0 };
        const delay = Math.min(attempts.count * 2000, 10000); // Max 10 second delay
        await new Promise(resolve => setTimeout(resolve, delay));
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };

  } catch (error) {
    logSecurityEvent('AUTH_ERROR', clientIP, { error: error.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};