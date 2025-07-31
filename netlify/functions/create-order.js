const Airtable = require('airtable');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const orderData = JSON.parse(event.body);

    const { customerName, contactInfo, pickupDay, numLoaves } = orderData;

    if (!customerName || !contactInfo || !pickupDay || !numLoaves) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const MAX_LOAVES_PER_DAY = 4;

    try {
        // Fetch existing orders for the specific pickupDay
        const records = await base('Orders').select({
            filterByFormula: `AND({Status} = 'Pending', {Pickup Day} = '${pickupDay}')`
        }).all();

        let orderedLoaves = 0;
        records.forEach(record => {
            orderedLoaves += record.get('Number of Loaves') || 0;
        });

        const available = MAX_LOAVES_PER_DAY - orderedLoaves;
        if (numLoaves > available) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Not enough stock available for the selected date' }) };
        }

        await base('Orders').create([
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

        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Order placed successfully' })
        };

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to place order' })
        };
    }
};