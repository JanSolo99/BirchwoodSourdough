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
    
    let requestData;
    try {
        requestData = JSON.parse(event.body);
    } catch (error) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid JSON in request body' }) 
        };
    }

    const { orderId, status } = requestData;

    // Validate required fields
    if (!orderId || !status) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Missing orderId or status' }) 
        };
    }

    // Validate status values
    const validStatuses = ['Pending Payment', 'Payment Received', 'Ready for Pickup', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid status. Must be: Pending Payment, Payment Received, Ready for Pickup, Completed, or Cancelled' }) 
        };
    }

    try {
        console.log(`Updating order ${orderId} to status: ${status}`);
        
        // Update the record in Airtable
        const updatedRecord = await base('Orders').update([
            {
                "id": orderId,
                "fields": {
                    "Status": status
                }
            }
        ]);

        console.log(`Order ${orderId} updated successfully`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                message: 'Order status updated successfully',
                orderId: orderId,
                newStatus: status
            })
        };

    } catch (error) {
        console.error('Error updating order status:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to update order status',
                details: error.message 
            })
        };
    }
};