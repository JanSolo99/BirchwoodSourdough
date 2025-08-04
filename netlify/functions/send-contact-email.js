const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { name, email, phone, subject, message } = JSON.parse(event.body);

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: name, email, subject, and message are required' })
            };
        }

        // Email to you (the business owner)
        const emailToOwner = await resend.emails.send({
            from: 'Birchwood Sourdough <noreply@birchwoodsourdough.com>',
            to: process.env.OWNER_EMAIL || 'janberkhout@up.me', // Replace with your actual email
            subject: `Contact Form: ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <hr>
                <p style="font-size: 0.9em; color: #666;">
                    This message was sent through the Birchwood Sourdough contact form.
                </p>
            `,
        });

        // Auto-reply to the customer
        const autoReply = await resend.emails.send({
            from: 'Birchwood Sourdough <noreply@birchwoodsourdough.com>',
            to: email,
            subject: 'Thank you for contacting Birchwood Sourdough',
            html: `
                <h2>Thank you for reaching out!</h2>
                <p>Hi ${name},</p>
                <p>Thank you for contacting Birchwood Sourdough. We've received your message and will get back to you as soon as possible.</p>
                
                <h3>Your message:</h3>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Subject:</strong> ${subject}</p>
                    <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
                </div>
                
                <p>In the meantime, feel free to follow us on <a href="https://instagram.com/birchwoodsourdough">Instagram @birchwoodsourdough</a> for updates on fresh bread availability!</p>
                
                <p>Best regards,<br>
                Birchwood Sourdough Team</p>
                
                <hr>
                <p style="font-size: 0.9em; color: #666;">
                    This is an automated response. Please do not reply to this email.
                </p>
            `,
        });

        console.log('Contact emails sent successfully:', {
            ownerEmail: emailToOwner.data?.id,
            autoReply: autoReply.data?.id
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: 'Contact form submitted successfully',
                emailSent: true
            })
        };

    } catch (error) {
        console.error('Error sending contact email:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to send contact email',
                details: error.message 
            })
        };
    }
};
