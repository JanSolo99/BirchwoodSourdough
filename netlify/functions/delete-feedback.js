const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    // A simple check for a secret header to protect this function
    if (event.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' }),
        };
    }

    try {
        const { id } = JSON.parse(event.body);
        await base('Feedback').destroy(id);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Feedback deleted successfully' }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete feedback' }),
        };
    }
};