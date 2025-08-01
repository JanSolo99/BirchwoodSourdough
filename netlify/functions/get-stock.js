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
        
        // Try multiple filtering approaches to ensure compatibility
        let records;
        try {
            // First try: Direct date comparison (works if Pickup Day is a Date field)
            records = await base('Orders').select({
                filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = '${date}')`
            }).all();
            console.log(`Direct date filter found ${records.length} orders`);
        } catch (error) {
            console.log('Direct date filter failed, trying string format:', error.message);
            // Fallback: Try as string comparison (if Pickup Day is still a text field)
            records = await base('Orders').select({
                filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = "${date}")`
            }).all();
            console.log(`String date filter found ${records.length} orders`);
        }

        records.forEach((record, index) => {
            const loaves = record.get('Number of Loaves') || 0;
            const pickupDay = record.get('Pickup Day');
            const customerName = record.get('Customer Name');
            console.log(`Order ${index + 1}: ${customerName}, ${loaves} loaves, pickup: ${pickupDay}`);
            stockForDate.ordered += loaves;
        });

        console.log(`Total ordered for ${date}: ${stockForDate.ordered}`);
        console.log(`Available for ${date}: ${stockForDate.max - stockForDate.ordered}`);

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