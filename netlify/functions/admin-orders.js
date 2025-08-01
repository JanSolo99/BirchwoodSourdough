const Airtable = require('airtable');
const { isValidSession } = require('./admin-auth');

exports.handler = async function(event, context) {
    // Enable CORS
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    // Check authentication
    const sessionToken = event.headers.authorization?.replace('Bearer ', '') || 
                        event.queryStringParameters?.sessionToken;

    if (!sessionToken || !isValidSession(sessionToken)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized - Invalid or expired session' })
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
            pickupLocation: record.get('Pickup Location') || '',
            numLoaves: record.get('Number of Loaves') || 0,
            totalAmount: record.get('Total Amount') || 0,
            orderReference: record.get('Order Reference') || '',
            orderDate: record.get('Order Date') || '',
            status: record.get('Status') || 'Pending Payment',
            paymentStatus: record.get('Payment Status') || 'Awaiting Payment'
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                orders: orders,
                totalCount: orders.length 
            })
        };

    } catch (error) {
        console.error('Error fetching orders:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch orders',
                details: error.message 
            })
        };
    }
};