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

    // Get stock limits for the date from Stock table, fallback to default
    let stockForDate = { max: 4, ordered: 0 }; // Default: 4 loaves max per day
    
    try {
        // Check if there's a stock limit set for this specific date
        const stockRecords = await base('Stock').select({
            filterByFormula: `{Date} = '${date}'`
        }).firstPage();
        
        if (stockRecords.length > 0) {
            stockForDate.max = stockRecords[0].get('Max Loaves') || 4;
            console.log(`Max loaves for ${date}: ${stockForDate.max} (from Stock table)`);
        } else {
            console.log(`Max loaves for ${date}: ${stockForDate.max} (using default - no Stock table entry)`);
        }
    } catch (error) {
        console.log(`Error fetching stock table, using default: ${error.message}`);
        console.log(`Max loaves for ${date}: ${stockForDate.max} (using default - Stock table error)`);
    }

    try {
        console.log(`Fetching orders for date: ${date}`);
        
        // Get all orders and filter manually (more reliable than Airtable formula)
        console.log('Getting all orders and filtering manually for better reliability');
        const allRecords = await base('Orders').select().all();
        console.log(`Total records in Orders table: ${allRecords.length}`);
        
        // Debug: show all pickup days in the database
        console.log('All pickup days in database:');
        allRecords.forEach((record, i) => {
            const pickupDay = record.get('Pickup Day');
            const customerName = record.get('Customer Name');
            const status = record.get('Status');
            const loaves = record.get('Number of Loaves');
            console.log(`  Record ${i + 1}: Customer="${customerName}", PickupDay="${pickupDay}", Status="${status}", Loaves=${loaves}`);
        });
        
        // Filter records for the specific date
        const records = allRecords.filter(record => {
            const pickupDay = record.get('Pickup Day');
            // Handle both string dates and Date objects
            let pickupDateStr = pickupDay;
            if (pickupDay instanceof Date) {
                pickupDateStr = pickupDay.toISOString().slice(0, 10);
            }
            const matches = pickupDateStr === date;
            console.log(`Checking: "${pickupDateStr}" === "${date}" ? ${matches}`);
            return matches;
        });
        console.log(`Manual filter found ${records.length} matching orders for ${date}`);

        // Count loaves from confirmed/paid orders for the date
        records.forEach((record, index) => {
            const loaves = record.get('Number of Loaves') || 0;
            const pickupDay = record.get('Pickup Day');
            const customerName = record.get('Customer Name');
            const status = record.get('Status');
            
            console.log(`Order ${index + 1}: ${customerName}, ${loaves} loaves, pickup: ${pickupDay}, status: ${status}`);
            
            // Count all orders except cancelled ones (including pending payment)
            const validStatuses = ['Pending Payment', 'Payment Received', 'Ready for Pickup', 'Completed', 'Confirmed'];
            if (validStatuses.includes(status)) {
                stockForDate.ordered += loaves;
                console.log(`  -> Counting ${loaves} loaves (status: ${status})`);
            } else {
                console.log(`  -> Not counting (status: ${status})`);
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