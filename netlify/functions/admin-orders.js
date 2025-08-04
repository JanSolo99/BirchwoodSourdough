const jwt = require('jsonwebtoken');
const Airtable = require('airtable');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-that-is-long-and-secure';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // Check for Authorization header
    if (!event.headers.authorization) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization header required' }) };
    }

    const token = event.headers.authorization.split(' ')[1];
    if (!token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token not provided' }) };
    }

    jwt.verify(token, JWT_SECRET);

    const records = await base('Orders').select({ view: 'Grid view' }).all();
    const orders = records.map(record => ({
      id: record.id,
      customerName: record.fields['Customer Name'],
      contactInfo: record.fields['Contact Info'],
      pickupDay: record.fields['Pickup Day'],
      pickupLocation: record.fields['Pickup Location'],
      numLoaves: record.fields['Number of Loaves'],
      totalAmount: record.fields['Total Amount'],
      orderDate: record.fields['Order Date'],
      status: record.fields['Status'],
      orderReference: record.fields['Order Reference']
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ orders }),
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    console.error('Error fetching orders:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
