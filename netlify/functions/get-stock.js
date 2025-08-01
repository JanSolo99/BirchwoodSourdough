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
        
        // Try multiple filtering approaches - count all confirmed orders, not just pending
        let records = [];
        
        // Updated filters to include all relevant order statuses (not just Pending)
        const filterAttempts = [
            `AND(OR({Status} = 'Pending Payment', {Status} = 'Payment Received', {Status} = 'Ready for Pickup', {Status} = 'Confirmed'), {Pickup Day} = '${date}')`,
            `AND(OR({Status} = "Pending Payment", {Status} = "Payment Received", {Status} = "Ready for Pickup", {Status} = "Confirmed"), {Pickup Day} = "${date}")`,
            `AND(OR(Status = 'Pending Payment', Status = 'Payment Received', Status = 'Ready for Pickup', Status = 'Confirmed'), {Pickup Day} = '${date}')`,
            `AND(OR(Status = "Pending Payment", Status = "Payment Received", Status = "Ready for Pickup", Status = "Confirmed"), {Pickup Day} = "${date}")`,
            `{Pickup Day} = '${date}'` // Fallback: get all orders for the date regardless of status
        ];
        
        for (let i = 0; i < filterAttempts.length; i++) {
            try {
                console.log(`Trying filter ${i + 1}: ${filterAttempts[i]}`);
                records = await base('Orders').select({
                    filterByFormula: filterAttempts[i]
                }).all();
                console.log(`Filter ${i + 1} found ${records.length} orders`);
                if (records.length > 0) {
                    console.log(`Success with filter ${i + 1}!`);
                    break;
                }
            } catch (error) {
                console.log(`Filter ${i + 1} failed:`, error.message);
            }
        }
        
        // If no filter worked, fall back to getting all records and filtering manually
        if (records.length === 0) {
            console.log('All filters failed, falling back to manual filtering');
            const allRecords = await base('Orders').select().all();
            records = allRecords.filter(record => {
                const pickupDay = record.get('Pickup Day');
                const status = record.get('Status');
                const isValidStatus = ['Pending Payment', 'Payment Received', 'Ready for Pickup', 'Confirmed', 'Pending'].includes(status);
                const matchesDate = pickupDay === date;
                
                console.log(`Checking record: Status="${status}", PickupDay="${pickupDay}", ValidStatus=${isValidStatus}, MatchesDate=${matchesDate}`);
                
                return matchesDate && isValidStatus;
            });
            console.log(`Manual filter found ${records.length} matching orders`);
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