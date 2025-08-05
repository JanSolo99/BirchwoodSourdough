const axios = require('axios');

const CELLCAST_APPKEY = process.env.CELLCAST_APPKEY;
const CELLCAST_API_URL = 'https://cellcast.com.au/api/v3/send-sms';

// Helper function to format phone number for Australian mobile
function formatPhoneNumber(phone) {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 04, convert to +614
  if (digits.startsWith('04')) {
    return '+614' + digits.substring(2);
  }
  
  // If it starts with 614, add +
  if (digits.startsWith('614')) {
    return '+' + digits;
  }
  
  // If it doesn't start with +, assume it needs +61
  if (!phone.startsWith('+')) {
    // Remove leading 0 if present and add +61
    const cleanDigits = digits.startsWith('0') ? digits.substring(1) : digits;
    return '+61' + cleanDigits;
  }
  
  return phone;
}

// Helper function to validate Australian mobile number
function isValidAustralianMobile(phone) {
  const formatted = formatPhoneNumber(phone);
  // Australian mobile numbers: +614xxxxxxxx (8 digits after +614)
  const mobileRegex = /^\+614\d{8}$/;
  return mobileRegex.test(formatted);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phoneNumber, testMessage } = JSON.parse(event.body);

    // Environment check
    if (!CELLCAST_APPKEY) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          error: 'CELLCAST_APPKEY not configured in environment variables',
          envCheck: {
            CELLCAST_APPKEY: !!CELLCAST_APPKEY,
            NODE_ENV: process.env.NODE_ENV || 'not set'
          }
        }) 
      };
    }

    // Phone number validation
    if (!phoneNumber) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Phone number required' }) 
      };
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!isValidAustralianMobile(formattedPhone)) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          error: 'Invalid Australian mobile number format',
          originalPhone: phoneNumber,
          formattedPhone: formattedPhone,
          isValid: false
        }) 
      };
    }

    console.log('Testing SMS to:', formattedPhone);

    const message = testMessage || `Test SMS from Birchwood Sourdough at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`;

    // Cellcast API request
    const smsData = {
      sms_text: message,
      numbers: [formattedPhone],
      from: 'Birchwood' // Will appear as sender name (max 11 chars)
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      auth: {
        username: CELLCAST_APPKEY,
        password: '' // Password is not required
      }
    };

    console.log('Sending test SMS to Cellcast...');
    console.log('API URL:', CELLCAST_API_URL);
    console.log('Request data:', JSON.stringify(smsData, null, 2));
    console.log('Auth config:', { username: CELLCAST_APPKEY ? 'SET' : 'NOT SET' });

    const response = await axios.post(CELLCAST_API_URL, smsData, axiosConfig);

    console.log('SMS sent successfully via Cellcast:', response.data);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true,
        message: 'Test SMS sent successfully via Cellcast.',
        details: {
          phoneNumber: formattedPhone,
          messageContent: message,
          response: response.data,
          timestamp: new Date().toISOString()
        }
      }) 
    };

  } catch (error) {
    console.error('Error sending test SMS via Cellcast:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to send test SMS.',
        details: {
          message: error.message,
          responseData: error.response?.data,
          status: error.response?.status,
          timestamp: new Date().toISOString()
        }
      }) 
    };
  }
};
