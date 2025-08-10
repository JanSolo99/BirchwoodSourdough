const jwt = require('jsonwebtoken');
const Airtable = require('airtable');

const JWT_SECRET = process.env.JWT_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://birchwood-sourdough.netlify.app'];

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  throw new Error('Missing required Airtable configuration');
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

function getCORSHeaders(origin) {
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || 
    (process.env.NODE_ENV === 'development' && origin && origin.includes('localhost'));
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

function logSecurityEvent(event, ip, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event} from ${ip}:`, details);
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, (match) => {
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

exports.handler = async (event, context) => {
  const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
  const origin = event.headers.origin;
  const headers = getCORSHeaders(origin);
  
  if (!JWT_SECRET) {
    logSecurityEvent('MISSING_JWT_SECRET', clientIP);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Service unavailable' })
    };
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // Check for Authorization header
    if (!event.headers.authorization) {
      logSecurityEvent('MISSING_AUTH_HEADER', clientIP);
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization header required' }) };
    }

    const authHeader = event.headers.authorization;
    if (!authHeader.startsWith('Bearer ')) {
      logSecurityEvent('INVALID_AUTH_FORMAT', clientIP);
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid authorization format' }) };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logSecurityEvent('MISSING_TOKEN', clientIP);
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token not provided' }) };
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Optional: Validate IP if stored in token
    if (decoded.ip && decoded.ip !== clientIP) {
      logSecurityEvent('TOKEN_IP_MISMATCH', clientIP, { tokenIP: decoded.ip });
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const records = await base('Orders').select({ view: 'Grid view' }).all();
    const orders = records.map(record => ({
      id: record.id,
      customerName: sanitizeString(record.fields['Customer Name']),
      contactInfo: sanitizeString(record.fields['Contact Info']),
      pickupDay: record.fields['Pickup Day'],
      pickupLocation: sanitizeString(record.fields['Pickup Location']),
      numLoaves: record.fields['Number of Loaves'],
      totalAmount: record.fields['Total Amount'],
      orderDate: record.fields['Order Date'],
      status: sanitizeString(record.fields['Status']),
      orderReference: sanitizeString(record.fields['Order Reference'])
    }));
    
    logSecurityEvent('ORDERS_ACCESSED', clientIP, { orderCount: orders.length });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ orders }),
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logSecurityEvent('INVALID_TOKEN', clientIP, { error: error.name });
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
    }
    logSecurityEvent('ORDERS_ERROR', clientIP, { error: error.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
