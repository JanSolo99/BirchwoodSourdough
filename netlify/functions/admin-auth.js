const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '7fcf4ba391c48784edde599889d6e3f1e47a27db36ecc050cc92f259bfac38afad2c68a1ae804d77075e8fb722503f3eca2b2c1006ee6f6c7b7628cb45fffd1d';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-that-is-long-and-secure';

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, password } = body;

    if (action === 'login') {
      if (!password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password is required' }) };
      }

      if (hashPassword(password) === ADMIN_PASSWORD_HASH) {
        const token = jwt.sign({ user: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, token }),
        };
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };

  } catch (error) {
    console.error('Auth error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};