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

    try {
        console.log('Fetching all orders for admin view');
        
        // Get all orders, sorted by most recent first
        const records = await base('Orders').select({
            sort: [{field: "Order Date", direction: "desc"}],
            maxRecords: 100 // Limit to prevent huge responses
        }).all();

        console.log(`Found ${records.length} total orders`);

        const orders = records.map(record => ({
            id: record.id,
            customerName: record.get('Customer Name') || '',
            contactInfo: record.get('Contact Info') || '',
            pickupDay: record.get('Pickup Day') || '',
            numLoaves: record.get('Number of Loaves') || 0,
            orderDate: record.get('Order Date') || '',
            status: record.get('Status') || 'Pending'
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                orders: orders,
                totalCount: orders.length 
            })
        };

    } catch (error) {
        console.error('Error fetching orders:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch orders',
                details: error.message 
            })
        };
    }
};