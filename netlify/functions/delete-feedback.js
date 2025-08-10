const jwt = require('jsonwebtoken');
const Airtable = require('airtable');

const JWT_SECRET = process.env.JWT_SECRET;
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',')[0] : 'https://birchwood-sourdough.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        // Check for JWT token in Authorization header
        if (!event.headers.authorization) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Authorization header required' }),
            };
        }

        const token = event.headers.authorization.split(' ')[1];
        jwt.verify(token, JWT_SECRET);

        const { id } = JSON.parse(event.body);
        await base('Feedback').destroy(id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Feedback deleted successfully' }),
        };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: 'Invalid or expired token' }) 
            };
        }
        console.error('Error deleting feedback:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to delete feedback' }),
        };
    }
};