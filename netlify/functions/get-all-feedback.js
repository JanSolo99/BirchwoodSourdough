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
        const records = await base('Feedback').select({
            sort: [{ field: 'Created', direction: 'desc' }],
        }).all();

        const feedback = records.map(record => ({
            id: record.id,
            name: record.get('Name'),
            feedback: record.get('Feedback'),
            rating: record.get('Rating'),
            status: record.get('Status'),
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(feedback),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch feedback' }),
        };
    }
};