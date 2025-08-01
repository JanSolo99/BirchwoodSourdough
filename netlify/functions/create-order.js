const Airtable = require('airtable');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }) 
        };
    }

    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        console.error('Missing Airtable credentials');
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Server configuration error' }) 
        };
    }
    
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    let orderData;
    try {
        orderData = JSON.parse(event.body);
    } catch (error) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid JSON in request body' }) 
        };
    }

    const { customerName, contactInfo, pickupDay, numLoaves } = orderData;

    // Validate required fields
    if (!customerName || !contactInfo || !pickupDay || !numLoaves) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Missing required fields' }) 
        };
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(pickupDay)) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid pickup date format. Use YYYY-MM-DD' }) 
        };
    }

    // Validate number of loaves
    if (!Number.isInteger(numLoaves) || numLoaves < 1 || numLoaves > 4) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Number of loaves must be between 1 and 4' }) 
        };
    }

    const MAX_LOAVES_PER_DAY = 4;

    try {
        console.log(`Creating order for ${customerName}, ${numLoaves} loaves on ${pickupDay}`);
        
        // Fetch existing orders for the specific pickupDay
        const records = await base('Orders').select({
            filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = '${pickupDay}')`
        }).all();

        console.log(`Found ${records.length} existing orders for ${pickupDay}`);

        let orderedLoaves = 0;
        records.forEach(record => {
            const loaves = record.get('Number of Loaves') || 0;
            orderedLoaves += loaves;
        });

        console.log(`Total loaves already ordered: ${orderedLoaves}`);

        const available = MAX_LOAVES_PER_DAY - orderedLoaves;
        if (numLoaves > available) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ 
                    error: `Not enough stock available. Only ${available} loaves remaining for ${pickupDay}` 
                }) 
            };
        }

        // Create the order record
        const createResponse = await base('Orders').create([
            {
                "fields": {
                    "Customer Name": customerName,
                    "Contact Info": contactInfo,
                    "Pickup Day": pickupDay,
                    "Number of Loaves": numLoaves,
                    "Order Date": new Date().toISOString().slice(0, 10),
                    "Status": "Pending"
                }
            }
        ]);

        console.log(`Order created successfully: ${createResponse[0].id}`);

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                message: 'Order placed successfully',
                orderId: createResponse[0].id 
            })
        };

    } catch (error) {
        console.error('Error creating order:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to place order',
                details: error.message 
            })
        };
    }
};