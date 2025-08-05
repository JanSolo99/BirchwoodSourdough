exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const envCheck = {
    // SMS Configuration
    CELLCAST_APPKEY: {
      set: !!process.env.CELLCAST_APPKEY,
      length: process.env.CELLCAST_APPKEY ? process.env.CELLCAST_APPKEY.length : 0,
      preview: process.env.CELLCAST_APPKEY ? process.env.CELLCAST_APPKEY.substring(0, 8) + '...' : 'NOT SET'
    },
    
    // Airtable Configuration
    AIRTABLE_API_KEY: {
      set: !!process.env.AIRTABLE_API_KEY,
      length: process.env.AIRTABLE_API_KEY ? process.env.AIRTABLE_API_KEY.length : 0,
      preview: process.env.AIRTABLE_API_KEY ? process.env.AIRTABLE_API_KEY.substring(0, 8) + '...' : 'NOT SET'
    },
    AIRTABLE_BASE_ID: {
      set: !!process.env.AIRTABLE_BASE_ID,
      length: process.env.AIRTABLE_BASE_ID ? process.env.AIRTABLE_BASE_ID.length : 0,
      preview: process.env.AIRTABLE_BASE_ID ? process.env.AIRTABLE_BASE_ID.substring(0, 8) + '...' : 'NOT SET'
    },

    // Email Configuration
    RESEND_API_KEY: {
      set: !!process.env.RESEND_API_KEY,
      length: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.length : 0,
      preview: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 8) + '...' : 'NOT SET'
    },
    OWNER_EMAIL: {
      set: !!process.env.OWNER_EMAIL,
      value: process.env.OWNER_EMAIL || 'NOT SET'
    },

    // Admin Configuration
    ADMIN_PASSWORD_HASH: {
      set: !!process.env.ADMIN_PASSWORD_HASH,
      length: process.env.ADMIN_PASSWORD_HASH ? process.env.ADMIN_PASSWORD_HASH.length : 0,
      preview: process.env.ADMIN_PASSWORD_HASH ? process.env.ADMIN_PASSWORD_HASH.substring(0, 8) + '...' : 'NOT SET'
    },

    // Netlify Configuration
    URL: {
      set: !!process.env.URL,
      value: process.env.URL || 'NOT SET'
    },
    DEPLOY_PRIME_URL: {
      set: !!process.env.DEPLOY_PRIME_URL,
      value: process.env.DEPLOY_PRIME_URL || 'NOT SET'
    },

    // Node Environment
    NODE_ENV: process.env.NODE_ENV || 'not set',
    NODE_VERSION: process.version,
    
    // Timestamp
    timestamp: new Date().toISOString(),
    timezone: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })
  };

  // Check for critical missing variables
  const critical = [];
  if (!process.env.CELLCAST_APPKEY) critical.push('CELLCAST_APPKEY');
  if (!process.env.AIRTABLE_API_KEY) critical.push('AIRTABLE_API_KEY');
  if (!process.env.AIRTABLE_BASE_ID) critical.push('AIRTABLE_BASE_ID');

  const warnings = [];
  if (!process.env.RESEND_API_KEY) warnings.push('RESEND_API_KEY');
  if (!process.env.OWNER_EMAIL) warnings.push('OWNER_EMAIL');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      environment: envCheck,
      status: {
        critical_missing: critical,
        warnings: warnings,
        sms_ready: !!process.env.CELLCAST_APPKEY,
        airtable_ready: !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID),
        email_ready: !!(process.env.RESEND_API_KEY && process.env.OWNER_EMAIL)
      }
    }, null, 2)
  };
};
