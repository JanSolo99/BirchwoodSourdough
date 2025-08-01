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

    await resend.emails.send({
      from: 'Birchwood Sourdough <noreply@yourdomain.com>', // Replace with your domain
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

    return { statusCode: 200, body: JSON.stringify({ message: 'Confirmation email sent successfully.' }) };

  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send confirmation email.' }) };
  }
};
