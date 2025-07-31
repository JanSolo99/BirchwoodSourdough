const Airtable = require('airtable');

exports.handler = async function(event, context) {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const dailyStock = {
        'Tuesday': { max: 4, ordered: 0 },
        'Wednesday': { max: 4, ordered: 0 },
        'Thursday': { max: 4, ordered: 0 },
    };

    try {
        const records = await base('Orders').select({
            filterByFormula: "{Status} = 'Pending'"
        }).all();

        records.forEach(record => {
            const day = record.get('Pickup Day');
            const loaves = record.get('Number of Loaves') || 0;
            if (dailyStock[day]) {
                dailyStock[day].ordered += loaves;
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify(dailyStock)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch stock levels' })
        };
    }
};