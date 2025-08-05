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
    const { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, totalAmount, orderReference } = JSON.parse(event.body);

    // Check if contact info looks like a phone number (contains digits, no @)
    if (!contactInfo || contactInfo.includes('@') || !/\d/.test(contactInfo)) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'Contact info is not a phone number. Skipping SMS confirmation.' 
        }) 
      };
    }

    // Check if we have Cellcast credentials
    if (!CELLCAST_APPKEY) {
      console.error('Cellcast credentials not configured');
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'SMS service not configured. Order created successfully.' 
        }) 
      };
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(contactInfo);
    
    if (!isValidAustralianMobile(formattedPhone)) {
      console.log('Invalid phone number format:', contactInfo, 'formatted as:', formattedPhone);
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'Invalid Australian mobile number format. Skipping SMS.' 
        }) 
      };
    }

    console.log('Sending SMS confirmation to:', formattedPhone);
    console.log('Order details:', { customerName, pickupDay, pickupLocation, numLoaves, totalAmount });

    const message = `Hi ${customerName}! Your Birchwood Sourdough order confirmed: ${numLoaves} loaf${numLoaves > 1 ? 'ves' : ''} for pickup on ${pickupDay} at ${pickupLocation || 'TBD location'}. Please pay A$${totalAmount} to PayID: janberkhout@up.me (Ref: ${orderReference}). Thanks!`;

    // Cellcast API request
    const smsData = {
      sms_text: message,
      numbers: [formattedPhone],
      from: 'Birchwood' // Will appear as sender name (max 11 chars)
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'APPKEY': CELLCAST_APPKEY
      }
    };

    console.log('Sending request to Cellcast...');

    const response = await axios.post(CELLCAST_API_URL, smsData, axiosConfig);

    console.log('SMS sent successfully via Cellcast:', response.data);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'SMS confirmation sent successfully via Cellcast.', 
        messageId: response.data.data?.[0]?.message_id || response.data.message_id 
      }) 
    };

  } catch (error) {
    console.error('Error sending SMS via Cellcast:', error.response?.data || error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to send SMS confirmation.',
        details: error.response?.data?.message || error.message 
      }) 
    };
  }
};