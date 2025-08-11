const axios = require('axios');

const CELLCAST_APPKEY = process.env.CELLCAST_APPKEY;
const CELLCAST_API_URL = 'https://cellcast.com.au/api/v3/send-sms';

// Helper function to format phone number
function formatPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('04')) {
    return '+614' + digits.substring(2);
  }
  
  if (digits.startsWith('614')) {
    return '+' + digits;
  }
  
  if (!phone.startsWith('+')) {
    const cleanDigits = digits.startsWith('0') ? digits.substring(1) : digits;
    return '+61' + cleanDigits;
  }
  
  return phone;
}

function isValidAustralianMobile(phone) {
  const formatted = formatPhoneNumber(phone);
  const mobileRegex = /^\+614\d{8}$/;
  return mobileRegex.test(formatted);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, orderReference, customMessage } = JSON.parse(event.body);

    // Check if contact info looks like a phone number
    if (!contactInfo || contactInfo.includes('@') || !/\d/.test(contactInfo)) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'Contact info is not a phone number. Skipping ready notification SMS.' 
        }) 
      };
    }

    // Check Cellcast credentials
    if (!CELLCAST_APPKEY) {
      console.error('Cellcast credentials not configured');
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'SMS service not configured.' 
        }) 
      };
    }

    const formattedPhone = formatPhoneNumber(contactInfo);
    
    if (!isValidAustralianMobile(formattedPhone)) {
      console.log('Invalid phone number format:', contactInfo);
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'Invalid phone number format. Skipping ready notification SMS.' 
        }) 
      };
    }

    console.log('Sending ready for pickup SMS to:', formattedPhone);

    // Use custom message if provided, otherwise use default
    const message = customMessage || `Hi ${customerName}! Great news - your order is ready for pickup on ${pickupDay} at ${pickupLocation || 'the usual location'}. Please text 0458145111 to arrange collection. Thanks for choosing Birchwood Sourdough!`;

    // Cellcast API request
    const smsData = {
      sms_text: message,
      numbers: [formattedPhone],
      from: 'Birchwood'
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'APPKEY': CELLCAST_APPKEY
      }
    };

    console.log('Sending request to Cellcast with headers:', axiosConfig.headers);

    const response = await axios.post(CELLCAST_API_URL, smsData, axiosConfig);

    console.log('Ready notification SMS sent via Cellcast:', response.data);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'Ready notification SMS sent successfully via Cellcast.', 
        messageId: response.data.data?.[0]?.message_id || response.data.message_id 
      }) 
    };

  } catch (error) {
    console.error('Error sending ready notification SMS via Cellcast:', error.response?.data || error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to send ready notification SMS.',
        details: error.response?.data?.message || error.message 
      }) 
    };
  }
};