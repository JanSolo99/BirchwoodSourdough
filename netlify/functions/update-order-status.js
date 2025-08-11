const jwt = require('jsonwebtoken');
const Airtable = require('airtable');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://birchwood-sourdough.netlify.app'];

function getCORSHeaders(origin) {
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || 
    (process.env.NODE_ENV === 'development' && origin && origin.includes('localhost'));
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
}

function logSecurityEvent(event, ip, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event} from ${ip}:`, details);
}
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

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
    
    if (decoded.ip && decoded.ip !== clientIP) {
      logSecurityEvent('TOKEN_IP_MISMATCH', clientIP, { tokenIP: decoded.ip });
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const { orderId, status } = JSON.parse(event.body);
    
    // Validate input
    if (!orderId || !status) {
      logSecurityEvent('INVALID_UPDATE_DATA', clientIP);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Order ID and status are required' }) };
    }
    
    // Validate status values
    const allowedStatuses = ['Pending Payment', 'Payment Received', 'Ready for Pickup', 'Completed', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      logSecurityEvent('INVALID_STATUS', clientIP, { status });
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status value' }) };
    }
    
    logSecurityEvent('ORDER_STATUS_UPDATE', clientIP, { orderId, status });

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
        const smsResponse = await axios.post(`${process.env.URL || 'https://birchwood-sourdough.netlify.app'}/.netlify/functions/send-payment-confirmation-sms`, {
          customerName: orderData['Customer Name'],
          contactInfo: orderData['Contact Info'],
          pickupDay: orderData['Pickup Day'],
          pickupLocation: orderData['Pickup Location'],
          numLoaves: orderData['Number of Loaves'],
          orderReference: orderData['Order Reference']
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Payment confirmation SMS sent successfully');
      } catch (smsError) {
        console.error('Error sending payment confirmation SMS:', smsError.message);
      }
    }

    // If status is being changed to "Ready for Pickup", send confirmation email/SMS
    if (status === 'Ready for Pickup') {
      try {
        const orderData = orderRecord.fields;
        const contactInfo = orderData['Contact Info'];
        
        // Send email if contact info is an email
        if (contactInfo && contactInfo.includes('@')) {
          try {
            const emailResponse = await axios.post(`${process.env.URL || 'https://birchwood-sourdough.netlify.app'}/.netlify/functions/send-ready-confirmation-email`, {
              customerName: orderData['Customer Name'],
              contactInfo: orderData['Contact Info'],
              pickupDay: orderData['Pickup Day'],
              pickupLocation: orderData['Pickup Location'],
              numLoaves: orderData['Number of Loaves'],
              orderReference: orderData['Order Reference']
            }, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            console.log('Ready confirmation email sent successfully');
          } catch (emailError) {
            console.error('Error sending ready confirmation email:', emailError.message);
          }
        }
        
        // Send SMS if contact info is a phone number
        if (contactInfo && !contactInfo.includes('@') && /\d/.test(contactInfo)) {
          try {
            const smsResponse = await axios.post(`${process.env.URL || 'https://birchwood-sourdough.netlify.app'}/.netlify/functions/send-ready-confirmation-sms`, {
              customerName: orderData['Customer Name'],
              contactInfo: orderData['Contact Info'],
              pickupDay: orderData['Pickup Day'],
              pickupLocation: orderData['Pickup Location'],
              numLoaves: orderData['Number of Loaves'],
              orderReference: orderData['Order Reference']
            }, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            console.log('Ready confirmation SMS sent successfully');
          } catch (smsError) {
            console.error('Error sending ready confirmation SMS:', smsError.message);
          }
        }
        
      } catch (error) {
        console.error('Error sending ready confirmation:', error.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logSecurityEvent('INVALID_TOKEN', clientIP, { error: error.name });
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
    }
    logSecurityEvent('ORDER_UPDATE_ERROR', clientIP, { error: error.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
