const Airtable = require('airtable');

exports.handler = async function(event, context) {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const date = event.queryStringParameters.date; // Get the date from query parameters

    if (!date) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing date parameter' }) };
    }

    const stockForDate = { max: 4, ordered: 0 }; // Initialize stock for the requested date

    try {
        const records = await base('Orders').select({
            filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = '${date}')`
        }).all();

        records.forEach(record => {
            const loaves = record.get('Number of Loaves') || 0;
            stockForDate.ordered += loaves;
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ [date]: stockForDate })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch stock levels' })
        };
    }
};