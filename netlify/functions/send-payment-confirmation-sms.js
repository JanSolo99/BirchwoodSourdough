const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let client;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

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

    // Check Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('Twilio credentials not configured');
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

    const smsResult = await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log('Payment confirmation SMS sent:', smsResult.sid);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'Payment confirmation SMS sent successfully.', 
        messageSid: smsResult.sid 
      }) 
    };

  } catch (error) {
    console.error('Error sending payment confirmation SMS:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to send payment confirmation SMS.',
        details: error.message 
      }) 
    };
  }
};