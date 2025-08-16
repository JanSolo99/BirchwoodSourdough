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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // Check authentication for admin requests
    if (event.headers.authorization) {
      const token = event.headers.authorization.split(' ')[1];
      jwt.verify(token, JWT_SECRET);
    }

    // Get maintenance status from Airtable
    let maintenanceMode = false;
    
    try {
      const records = await base('Settings').select({
        filterByFormula: `{Key} = 'maintenance_mode'`
      }).firstPage();

      if (records.length > 0) {
        maintenanceMode = records[0].get('Value') === 'true';
      }
    } catch (error) {
      console.log('Settings table not found or error, defaulting to false:', error.message);
      // If Settings table doesn't exist, default to false (not in maintenance)
    }

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ maintenanceMode }) 
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      // For non-admin requests without auth, still return maintenance status
      try {
        const records = await base('Settings').select({
          filterByFormula: `{Key} = 'maintenance_mode'`
        }).firstPage();

        const maintenanceMode = records.length > 0 ? records[0].get('Value') === 'true' : false;
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ maintenanceMode }) 
        };
      } catch (airtableError) {
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ maintenanceMode: false }) 
        };
      }
    }
    
    console.error('Error getting maintenance status:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};