const { Resend } = require('resend');
const { sanitizeForHTML, logSecurityEvent } = require('./security-utils');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = new Resend(RESEND_API_KEY);

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

exports.handler = async (event, context) => {
  const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
  
  if (event.httpMethod !== 'POST') {
    logSecurityEvent('INVALID_METHOD_EMAIL', clientIP, { method: event.httpMethod });
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, orderReference, customSubject, customMessage } = JSON.parse(event.body);

    // Validate inputs
    if (!customerName || !contactInfo || !pickupDay || !numLoaves) {
      logSecurityEvent('EMAIL_MISSING_FIELDS', clientIP);
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Email validation
    if (!contactInfo.includes('@') || !validateEmail(contactInfo)) {
      logSecurityEvent('EMAIL_INVALID_FORMAT', clientIP);
      return { statusCode: 200, body: JSON.stringify({ message: 'Contact info is not a valid email address. Skipping ready notification email.' }) };
    }
    
    // Sanitize inputs
    const safeCustomerName = sanitizeForHTML(customerName);
    const safePickupLocation = sanitizeForHTML(pickupLocation);
    const safeOrderReference = sanitizeForHTML(orderReference);

    // Check if we have the API key
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable not set');
      return { statusCode: 200, body: JSON.stringify({ message: 'Email service not configured.' }) };
    }

    console.log('Sending ready for pickup email to:', contactInfo);
    console.log('Order details:', { customerName, pickupDay, pickupLocation, numLoaves });

    // Determine the from address - use verified domain if available, otherwise development domain
    const fromAddress = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    console.log('Using from address:', fromAddress);

    // Use custom message if provided, otherwise use default
    const emailSubject = customSubject || 'Your Birchwood Sourdough Order is Ready!';
    const emailBody = customMessage ? sanitizeForHTML(customMessage).replace(/\n/g, '<br>') : `
        <h1>Great news, ${safeCustomerName}!</h1>
        <p>Your order for ${numLoaves} ${numLoaves > 1 ? 'loaves' : 'loaf'} is now ready for pickup!</p>
        <p><strong>Pickup Details:</strong></p>
        <ul>
          <li><strong>Date:</strong> ${pickupDay}</li>
          <li><strong>Location:</strong> ${safePickupLocation || 'TBD'}</li>
          <li><strong>Order Reference:</strong> ${safeOrderReference}</li>
        </ul>
        <p><strong>To arrange collection, please text 0458145111.</strong></p>
        <p>Thank you for choosing Birchwood Sourdough!</p>
        <p>The Birchwood Sourdough Team</p>
      `;

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: [contactInfo],
      subject: emailSubject,
      html: emailBody,
    });

    console.log('Ready notification email sent successfully:', emailResult);
    return { statusCode: 200, body: JSON.stringify({ message: 'Ready notification email sent successfully.', emailId: emailResult.data?.id }) };

  } catch (error) {
    console.error('Error sending ready notification email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send ready notification email.' }) };
  }
};