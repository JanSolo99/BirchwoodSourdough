const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = new Resend(RESEND_API_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, totalAmount, orderReference } = JSON.parse(event.body);

    // Basic email validation
    if (!contactInfo || !contactInfo.includes('@')) {
      return { statusCode: 200, body: JSON.stringify({ message: 'Contact info is not a valid email address. Skipping email confirmation.' }) };
    }

    // Check if we have the API key
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable not set');
      return { statusCode: 200, body: JSON.stringify({ message: 'Email service not configured. Order created successfully.' }) };
    }

    console.log('Sending confirmation email to:', contactInfo);
    console.log('Order details:', { customerName, pickupDay, pickupLocation, numLoaves, totalAmount });

    // Determine the from address - use verified domain if available, otherwise development domain
    const fromAddress = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    console.log('Using from address:', fromAddress);

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: [contactInfo],
      subject: 'Your Birchwood Sourdough Order Confirmation',
      html: `
        <h1>Thanks for your order, ${customerName}!</h1>
        <p>Your order for ${numLoaves} loaf/loaves on ${pickupDay} at ${pickupLocation} has been received.</p>
        <p>To confirm your order, please make a payment of A$${totalAmount} to the following PayID:</p>
        <ul>
          <li><strong>PayID:</strong> janberkhout@up.me</li>
          <li><strong>Amount:</strong> A$${totalAmount}</li>
          <li><strong>Reference:</strong> ${orderReference}</li>
        </ul>
        <p>Your order will only be confirmed once payment is received. Please include the reference number.</p>
        <p>Thanks for your support!</p>
        <p>The Birchwood Sourdough Team</p>
      `,
    });

    console.log('Email sent successfully:', emailResult);
    return { statusCode: 200, body: JSON.stringify({ message: 'Confirmation email sent successfully.', emailId: emailResult.data?.id }) };

  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send confirmation email.' }) };
  }
};
