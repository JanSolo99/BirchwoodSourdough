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
    const { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, orderReference } = JSON.parse(event.body);

    // Check if contact info looks like a phone number
    if (!contactInfo || contactInfo.includes('@') || !/\d/.test(contactInfo)) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'Contact info is not a phone number. Skipping SMS.' 
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
          message: 'Invalid phone number format. Skipping SMS.' 
        }) 
      };
    }

    console.log('Sending payment confirmation SMS to:', formattedPhone);

    const message = `Great news ${customerName}! Your payment has been received. Your ${numLoaves} loaf${numLoaves > 1 ? 'ves' : ''} will be ready for pickup on ${pickupDay} at ${pickupLocation || 'the usual location'}. Thanks for choosing Birchwood Sourdough!`;

    // Cellcast API request
    const smsData = {
      to: [formattedPhone],
      message: message,
      from: 'Birchwood'
    };

    const response = await axios.post(CELLCAST_API_URL, smsData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CELLCAST_APPKEY}`
      }
    });

    console.log('Payment confirmation SMS sent via Cellcast:', response.data);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'Payment confirmation SMS sent successfully via Cellcast.', 
        messageId: response.data.data?.[0]?.message_id || response.data.message_id 
      }) 
    };

  } catch (error) {
    console.error('Error sending payment confirmation SMS via Cellcast:', error.response?.data || error.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to send payment confirmation SMS.',
        details: error.response?.data?.message || error.message 
      }) 
    };
  }
};