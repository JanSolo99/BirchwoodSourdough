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

    try {
        console.log(`Debug: Fetching ALL orders to understand data structure`);
        
        // First, let's get ALL orders to see the data structure
        const allRecords = await base('Orders').select({
            maxRecords: 20,
            sort: [{field: "Order Date", direction: "desc"}]
        }).all();

        console.log(`Debug: Found ${allRecords.length} total orders`);
        
        let debugInfo = [];
        allRecords.forEach((record, index) => {
            const pickupDay = record.get('Pickup Day');
            const status = record.get('Status');
            const loaves = record.get('Number of Loaves');
            const customer = record.get('Customer Name');
            
            console.log(`Debug Order ${index + 1}: Customer="${customer}", Pickup="${pickupDay}", Status="${status}", Loaves=${loaves}`);
            
            debugInfo.push({
                customer,
                pickupDay,
                pickupDayType: typeof pickupDay,
                status,
                loaves,
                matchesDate: pickupDay === date,
                matchesStatus: status === 'Pending'
            });
        });

        // Now try the filtered query
        console.log(`Debug: Now trying filtered query for date: ${date}`);
        
        const filteredRecords = await base('Orders').select({
            filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = '${date}')`
        }).all();

        console.log(`Debug: Filtered query returned ${filteredRecords.length} records`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                debugInfo,
                requestedDate: date,
                totalRecords: allRecords.length,
                filteredRecords: filteredRecords.length,
                filteredData: filteredRecords.map(r => ({
                    customer: r.get('Customer Name'),
                    pickupDay: r.get('Pickup Day'),
                    status: r.get('Status'),
                    loaves: r.get('Number of Loaves')
                }))
            })
        };
    } catch (error) {
        console.error('Debug error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Debug failed',
                details: error.message 
            })
        };
    }
};