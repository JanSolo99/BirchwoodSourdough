const crypto = require('crypto');

// In production, store this in Netlify environment variables
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec'; // Default: "admin123" - CHANGE THIS!

// Session storage (in production, use a proper database or Redis)
const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isValidSession(token) {
  const session = sessions.get(token);
  if (!session) return false;
  
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }
  
  return true;
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    if (event.httpMethod === 'POST') {
      const { action, password, sessionToken } = body;

      if (action === 'login') {
        if (!password) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Password is required' })
          };
        }

        const hashedPassword = hashPassword(password);
        
        if (hashedPassword === ADMIN_PASSWORD_HASH) {
          const token = generateSessionToken();
          const expires = Date.now() + SESSION_DURATION;
          
          sessions.set(token, { 
            created: Date.now(), 
            expires,
            ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
          });

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              sessionToken: token,
              expires: new Date(expires).toISOString()
            })
          };
        } else {
          // Add a small delay to prevent brute force attacks
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid password' })
          };
        }
      }

      if (action === 'verify') {
        if (!sessionToken) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Session token is required' })
          };
        }

        const isValid = isValidSession(sessionToken);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ valid: isValid })
        };
      }

      if (action === 'logout') {
        if (sessionToken) {
          sessions.delete(sessionToken);
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request' })
    };

  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Export session validation for other functions
exports.isValidSession = isValidSession;
