const Airtable = require('airtable');

exports.handler = async function(event, context) {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        console.error('Missing Airtable credentials');
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Server configuration error' }) 
        };
    }
    
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const date = event.queryStringParameters?.date;

    if (!date) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Missing date parameter' }) 
        };
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }) 
        };
    }

    const stockForDate = { max: 4, ordered: 0 };

    try {
        console.log(`Fetching orders for date: ${date}`);
        
        // Use date comparison for more robust filtering
        const records = await base('Orders').select({
            filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = '${date}')`
        }).all();

        console.log(`Found ${records.length} orders for ${date}`);

        records.forEach(record => {
            const loaves = record.get('Number of Loaves') || 0;
            stockForDate.ordered += loaves;
            console.log(`Order: ${loaves} loaves`);
        });

        console.log(`Total ordered for ${date}: ${stockForDate.ordered}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ [date]: stockForDate })
        };
    } catch (error) {
        console.error('Error fetching stock levels:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch stock levels',
                details: error.message 
            })
        };
    }
};