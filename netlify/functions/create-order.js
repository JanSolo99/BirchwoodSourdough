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

    const dailyStock = {
        'Tuesday': { max: 4, ordered: 0 },
        'Wednesday': { max: 4, ordered: 0 },
        'Thursday': { max: 4, ordered: 0 },
    };

    try {
        const records = await base('Orders').select({
            filterByFormula: "{Status} = 'Pending'"
        }).all();

        records.forEach(record => {
            const day = record.get('Pickup Day');
            const loaves = record.get('Number of Loaves') || 0;
            if (dailyStock[day]) {
                dailyStock[day].ordered += loaves;
            }
        });

        const available = dailyStock[pickupDay].max - dailyStock[pickupDay].ordered;
        if (numLoaves > available) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Not enough stock available' }) };
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