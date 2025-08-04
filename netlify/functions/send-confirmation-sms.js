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
  // Australian mobile numbers: +614xxxxxxxx (9 digits after +614)
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

    // Check if we have Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('Twilio credentials not configured');
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

    const smsResult = await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log('SMS sent successfully:', smsResult.sid);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'SMS confirmation sent successfully.', 
        messageSid: smsResult.sid 
      }) 
    };

  } catch (error) {
    console.error('Error sending SMS:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to send SMS confirmation.',
        details: error.message 
      }) 
    };
  }
};