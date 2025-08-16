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

    // Get current maintenance status
    let currentStatus = false;
    let existingRecord = null;
    
    try {
      const records = await base('Settings').select({
        filterByFormula: `{Key} = 'maintenance_mode'`
      }).firstPage();

      if (records.length > 0) {
        existingRecord = records[0];
        currentStatus = records[0].get('Value') === 'true';
      }
    } catch (error) {
      console.log('Settings table not found, will create it:', error.message);
    }

    // Toggle the status
    const newStatus = !currentStatus;
    const newValue = newStatus ? 'true' : 'false';

    try {
      if (existingRecord) {
        // Update existing record
        await base('Settings').update(existingRecord.id, {
          'Value': newValue
        });
      } else {
        // Create new record
        await base('Settings').create({
          'Key': 'maintenance_mode',
          'Value': newValue
        });
      }
    } catch (error) {
      console.error('Error updating Settings table:', error);
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Failed to update maintenance status' }) 
      };
    }

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        maintenanceMode: newStatus,
        message: newStatus ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
      }) 
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    console.error('Error toggling maintenance mode:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};