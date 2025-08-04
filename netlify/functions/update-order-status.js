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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { orderId, status } = JSON.parse(event.body);

    // First, get the order details before updating
    let orderRecord;
    try {
      orderRecord = await base('Orders').find(orderId);
    } catch (error) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
    }

    await base('Orders').update([
      {
        id: orderId,
        fields: {
          Status: status,
        },
      },
    ]);

    // If status is being changed to "Payment Received" or "Confirmed", send SMS
    if (status === 'Payment Received' || status === 'Confirmed') {
      try {
        const orderData = orderRecord.fields;
        const smsResponse = await fetch('/.netlify/functions/send-payment-confirmation-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerName: orderData['Customer Name'],
            contactInfo: orderData['Contact Info'],
            pickupDay: orderData['Pickup Day'],
            pickupLocation: orderData['Pickup Location'],
            numLoaves: orderData['Number of Loaves'],
            orderReference: orderData['Order Reference']
          })
        });
        
        if (!smsResponse.ok) {
          console.error('Failed to send payment confirmation SMS:', await smsResponse.text());
        }
      } catch (smsError) {
        console.error('Error sending payment confirmation SMS:', smsError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
    }
    console.error('Error updating order status:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
