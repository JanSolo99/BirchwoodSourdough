// Shared security utilities for Netlify functions
const crypto = require('crypto');

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://birchwood-sourdough.netlify.app'];

// CSRF token store (use Redis in production)
const csrfTokens = new Map();
const CSRF_TOKEN_LIFETIME = 30 * 60 * 1000; // 30 minutes

function getCORSHeaders(origin) {
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || 
    (process.env.NODE_ENV === 'development' && origin && origin.includes('localhost'));
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

function logSecurityEvent(event, ip, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event} from ${ip}:`, details);
}

function sanitizeForHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>\"'&]/g, (match) => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    };
    return entities[match];
  });
}

function generateCSRFToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + CSRF_TOKEN_LIFETIME;
  csrfTokens.set(token, expiry);
  
  // Clean up expired tokens
  for (const [t, exp] of csrfTokens.entries()) {
    if (exp < Date.now()) {
      csrfTokens.delete(t);
    }
  }
  
  return token;
}

function validateCSRFToken(token) {
  if (!token || !csrfTokens.has(token)) {
    return false;
  }
  
  const expiry = csrfTokens.get(token);
  if (expiry < Date.now()) {
    csrfTokens.delete(token);
    return false;
  }
  
  // Token is valid - remove it (single use)
  csrfTokens.delete(token);
  return true;
}

function validateJWT(token, secret, clientIP) {
  if (!secret) {
    throw new Error('JWT_SECRET_MISSING');
  }
  
  const jwt = require('jsonwebtoken');
  const decoded = jwt.verify(token, secret);
  
  // Optional: Validate IP if stored in token
  if (decoded.ip && decoded.ip !== clientIP) {
    throw new Error('IP_MISMATCH');
  }
  
  return decoded;
}

function createSecureResponse(statusCode, headers, body) {
  return {
    statusCode,
    headers: {
      ...headers,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

module.exports = {
  getCORSHeaders,
  logSecurityEvent,
  sanitizeForHTML,
  generateCSRFToken,
  validateCSRFToken,
  validateJWT,
  createSecureResponse,
  ALLOWED_ORIGINS
};