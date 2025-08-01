const { Resend } = require('resend');

exports.handler = async (event, context) => {
  const { RESEND_API_KEY } = process.env;
  
  console.log('Testing Resend configuration...');
  console.log('Has API Key:', !!RESEND_API_KEY);
  console.log('API Key length:', RESEND_API_KEY ? RESEND_API_KEY.length : 0);
  
  if (!RESEND_API_KEY) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'RESEND_API_KEY environment variable not set',
        hasKey: false
      })
    };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    
    // Test sending a simple email
    const testEmail = 'janberkhout@up.me'; // Using your PayID email for testing
    
    console.log('Attempting to send test email...');
    
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev', // Using Resend's development domain
      to: [testEmail],
      subject: 'Resend Test Email',
      html: `
        <h1>Resend Test Email</h1>
        <p>This is a test email to verify Resend integration is working.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });

    console.log('Email sent successfully:', result);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Test email sent successfully',
        result: result,
        hasKey: true,
        keyLength: RESEND_API_KEY.length
      })
    };

  } catch (error) {
    console.error('Resend test failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Resend test failed',
        details: error.message,
        stack: error.stack,
        hasKey: true,
        keyLength: RESEND_API_KEY.length
      })
    };
  }
};
