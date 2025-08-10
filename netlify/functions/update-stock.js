const jwt = require('jsonwebtoken');
const Airtable = require('airtable');

const JWT_SECRET = process.env.JWT_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',')[0] : 'https://birchwood-sourdough.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const token = event.headers.authorization.split(' ')[1];
    jwt.verify(token, JWT_SECRET);

    const { date, maxLoaves } = JSON.parse(event.body);

    // Find existing stock record for the date
    const records = await base('Stock').select({
      filterByFormula: `{Date} = '${date}'`
    }).firstPage();

    if (records.length > 0) {
      // Update existing record
      await base('Stock').update(records[0].id, {
        'Max Loaves': maxLoaves
      });
    } else {
      // Create new record
      await base('Stock').create({
        'Date': date,
        'Max Loaves': maxLoaves
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    console.error('Error updating stock:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
