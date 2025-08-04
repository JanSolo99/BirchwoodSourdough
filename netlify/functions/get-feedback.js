const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async () => {
    try {
        const records = await base('Feedback').select({
            filterByFormula: "{Status} = 'Approved'",
            sort: [{ field: 'Created', direction: 'desc' }],
            maxRecords: 10,
        }).all();

        const feedback = records.map(record => ({
            id: record.id,
            name: record.get('Name'),
            feedback: record.get('Feedback'),
            rating: record.get('Rating'),
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(feedback),
        };
    } catch (error) {
        console.error('Error fetching feedback from Airtable:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch feedback', details: error.message }),
        };
    }
};