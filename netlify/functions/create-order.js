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

    console.log('Received order data:', {
        customerName,
        contactInfo,
        pickupDay,
        pickupLocation,
        numLoaves,
        totalAmount
    });

    // Validate required fields
    if (!customerName || !contactInfo || !pickupDay || !numLoaves) {
        console.log('Missing required fields:', {
            customerName: !!customerName,
            contactInfo: !!contactInfo,
            pickupDay: !!pickupDay,
            numLoaves: !!numLoaves
        });
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Missing required fields: customerName, contactInfo, pickupDay, numLoaves' }) 
        };
    }

    // Make pickup location optional for now to prevent errors
    if (!pickupLocation) {
        console.log('Warning: No pickup location provided, using default');
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
            `AND(OR({Status} = 'Pending Payment', {Status} = 'Payment Received', {Status} = 'Ready for Pickup', {Status} = 'Confirmed'), {Pickup Day} = '${pickupDay}')`,
            `AND(OR({Status} = "Pending Payment", {Status} = "Payment Received", {Status} = "Ready for Pickup", {Status} = "Confirmed"), {Pickup Day} = "${pickupDay}")`,
            `AND(OR(Status = 'Pending Payment', Status = 'Payment Received', Status = 'Ready for Pickup', Status = 'Confirmed'), {Pickup Day} = '${pickupDay}')`,
            `AND(OR(Status = "Pending Payment", Status = "Payment Received", Status = "Ready for Pickup", Status = "Confirmed"), {Pickup Day} = "${pickupDay}")`,
            `{Pickup Day} = '${pickupDay}'` // Fallback: get all orders for the date
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
                const isValidStatus = ['Pending Payment', 'Payment Received', 'Ready for Pickup', 'Confirmed', 'Pending'].includes(status);
                return pickupDay_record === pickupDay && isValidStatus;
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

        // Create the order record with backward compatibility
        const orderReference = `BreadOrder-${customerName.replace(/\s+/g, '')}`;
        const calculatedTotal = totalAmount || (numLoaves * 8);
        
        // Start with basic fields that we know exist
        const fields = {
            "Customer Name": customerName,
            "Contact Info": contactInfo,
            "Pickup Day": pickupDay,
            "Number of Loaves": numLoaves,
            "Order Date": new Date().toISOString().slice(0, 10),
            "Status": "Pending Payment" // Set default status
        };

        // Add optional fields only if they have values
        if (pickupLocation) {
            fields["Pickup Location"] = pickupLocation;
        }
        if (calculatedTotal) {
            fields["Total Amount"] = calculatedTotal;
        }
        if (orderReference) {
            fields["Order Reference"] = orderReference;
        }

        console.log('Creating Airtable record with fields:', fields);

        const createResponse = await base('Orders').create([
            {
                "fields": fields
            }
        ]);

        // Send confirmation email
        try {
          const emailResponse = await fetch('/.netlify/functions/send-confirmation-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customerName,
              contactInfo,
              pickupDay,
              pickupLocation,
              numLoaves,
              totalAmount: calculatedTotal,
              orderReference
            })
          });
          if (!emailResponse.ok) {
            console.error('Failed to send confirmation email:', await emailResponse.text());
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }

        // Send confirmation SMS
        try {
          const smsResponse = await fetch('/.netlify/functions/send-confirmation-sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customerName,
              contactInfo,
              pickupDay,
              pickupLocation,
              numLoaves,
              totalAmount: calculatedTotal,
              orderReference
            })
          });
          if (!smsResponse.ok) {
            console.error('Failed to send confirmation SMS:', await smsResponse.text());
          }
        } catch (smsError) {
          console.error('Error sending confirmation SMS:', smsError);
        }

        console.log(`Order created successfully: ${createResponse[0].id}`);
        console.log(`New order details: Customer=${customerName}, Loaves=${numLoaves}, Date=${pickupDay}, Location=${pickupLocation || 'TBD'}, Amount=A$${calculatedTotal}`);

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
                totalAmount: calculatedTotal
            })
        };

    } catch (error) {
        console.error('Error creating order:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to place order',
                details: error.message 
            })
        };
    }
};