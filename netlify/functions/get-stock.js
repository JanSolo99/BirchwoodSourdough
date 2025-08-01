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

    // Get stock limits for the date
    let stockForDate = { max: 4, ordered: 0 }; // Default values
    
    try {
        const stockRecords = await base('Stock').select({
            filterByFormula: `{Date} = '${date}'`
        }).firstPage();

        if (stockRecords.length > 0) {
            stockForDate.max = stockRecords[0].fields['Max Loaves'] || 4;
        }
        console.log(`Max loaves for ${date}: ${stockForDate.max}`);
    } catch (error) {
        console.log('Error fetching stock limits, using default:', error.message);
    }

    try {
        console.log(`Fetching orders for date: ${date}`);
        
        // Simple approach: get all orders for the specific date
        let records = [];
        
        try {
            // Try with simple date filter first
            records = await base('Orders').select({
                filterByFormula: `{Pickup Day} = '${date}'`
            }).all();
            console.log(`Found ${records.length} orders for date ${date}`);
        } catch (error) {
            console.log(`Date filter failed: ${error.message}`);
            
            // If that fails, get all records and filter manually
            console.log('Falling back to manual filtering');
            const allRecords = await base('Orders').select().all();
            records = allRecords.filter(record => {
                const pickupDay = record.get('Pickup Day');
                return pickupDay === date;
            });
            console.log(`Manual filter found ${records.length} matching orders`);
        }

        // Count loaves from all orders (regardless of status) for the date
        records.forEach((record, index) => {
            const loaves = record.get('Number of Loaves') || 0;
            const pickupDay = record.get('Pickup Day');
            const customerName = record.get('Customer Name');
            const status = record.get('Status');
            
            console.log(`Order ${index + 1}: ${customerName}, ${loaves} loaves, pickup: ${pickupDay}, status: ${status}`);
            
            // Only count orders that aren't cancelled
            if (status !== 'Cancelled') {
                stockForDate.ordered += loaves;
            }
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