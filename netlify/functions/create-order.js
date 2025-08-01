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

    const { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, totalAmount } = orderData;

    // Validate required fields
    if (!customerName || !contactInfo || !pickupDay || !pickupLocation || !numLoaves) {
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
        
        // Fetch existing orders for the specific pickupDay with multiple filter attempts
        let records = [];
        
        const filterAttempts = [
            `AND({Status} = 'Pending', {Pickup Day} = '${pickupDay}')`,
            `AND({Status} = "Pending", {Pickup Day} = "${pickupDay}")`,
            `AND(Status = 'Pending', {Pickup Day} = '${pickupDay}')`,
            `AND(Status = "Pending", {Pickup Day} = "${pickupDay}")`,
        ];
        
        for (let i = 0; i < filterAttempts.length; i++) {
            try {
                console.log(`Trying filter ${i + 1}: ${filterAttempts[i]}`);
                records = await base('Orders').select({
                    filterByFormula: filterAttempts[i]
                }).all();
                console.log(`Filter ${i + 1} found ${records.length} existing orders for ${pickupDay}`);
                if (records.length > 0) {
                    console.log(`Success with filter ${i + 1}!`);
                    break;
                }
            } catch (error) {
                console.log(`Filter ${i + 1} failed:`, error.message);
            }
        }
        
        // If no filter worked, fall back to manual filtering
        if (records.length === 0) {
            console.log('All filters failed, falling back to manual filtering');
            const allRecords = await base('Orders').select().all();
            records = allRecords.filter(record => {
                const pickupDay_record = record.get('Pickup Day');
                const status = record.get('Status');
                return status === 'Pending' && pickupDay_record === pickupDay;
            });
            console.log(`Manual filter found ${records.length} existing orders for ${pickupDay}`);
        }

        let orderedLoaves = 0;
        records.forEach((record, index) => {
            const loaves = record.get('Number of Loaves') || 0;
            const customer = record.get('Customer Name');
            const pickup = record.get('Pickup Day');
            console.log(`Existing order ${index + 1}: ${customer}, ${loaves} loaves, pickup: ${pickup}`);
            orderedLoaves += loaves;
        });

        console.log(`Total loaves already ordered for ${pickupDay}: ${orderedLoaves}`);

        const available = MAX_LOAVES_PER_DAY - orderedLoaves;
        console.log(`Available loaves for ${pickupDay}: ${available}`);
        
        if (numLoaves > available) {
            console.log(`Order rejected: requested ${numLoaves}, only ${available} available`);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ 
                    error: `Not enough stock available. Only ${available} loaves remaining for ${pickupDay}` 
                }) 
            };
        }

        // Create the order record
        const orderReference = `BreadOrder-${pickupDay}-${customerName.replace(/\s+/g, '')}`;
        
        const createResponse = await base('Orders').create([
            {
                "fields": {
                    "Customer Name": customerName,
                    "Contact Info": contactInfo,
                    "Pickup Day": pickupDay,
                    "Pickup Location": pickupLocation,
                    "Number of Loaves": numLoaves,
                    "Total Amount": totalAmount || (numLoaves * 8),
                    "Order Reference": orderReference,
                    "Order Date": new Date().toISOString().slice(0, 10),
                    "Status": "Pending Payment",
                    "Payment Status": "Awaiting Payment"
                }
            }
        ]);

        console.log(`Order created successfully: ${createResponse[0].id}`);
        console.log(`New order details: Customer=${customerName}, Loaves=${numLoaves}, Date=${pickupDay}, Location=${pickupLocation}, Amount=A$${totalAmount || (numLoaves * 8)}`);

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                message: 'Order placed successfully - awaiting payment confirmation',
                orderId: createResponse[0].id,
                orderReference: orderReference,
                totalAmount: totalAmount || (numLoaves * 8)
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