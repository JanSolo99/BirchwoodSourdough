const jwt = require('jsonwebtoken');
const Airtable = require('airtable');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-that-is-long-and-secure';
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

        const records = await base('Feedback').select({
            sort: [{ field: 'Created', direction: 'desc' }],
        }).all();

        const feedback = records.map(record => ({
            id: record.id,
            name: record.get('Name'),
            feedback: record.get('Feedback'),
            rating: record.get('Rating'),
            status: record.get('Status'),
            created: record.get('Created'),
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(feedback),
        };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ error: 'Invalid or expired token' }) 
            };
        }
        console.error('Error fetching feedback:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch feedback' }),
        };
    }
};