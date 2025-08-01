const Airtable = require('airtable');

exports.handler = async function(event, context) {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    
    console.log('Environment check:', {
        hasApiKey: !!AIRTABLE_API_KEY,
        hasBaseId: !!AIRTABLE_BASE_ID,
        apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
        baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
    });
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Missing Airtable credentials' }) 
        };
    }
    
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    try {
        console.log('Testing Airtable connection...');
        
        // Try to read the table structure
        const records = await base('Orders').select({
            maxRecords: 1
        }).all();
        
        console.log('Connection successful, found', records.length, 'records');
        
        if (records.length > 0) {
            const sampleRecord = records[0];
            console.log('Sample record fields:', Object.keys(sampleRecord.fields));
            console.log('Sample record data:', sampleRecord.fields);
        }

        // Try to create a test record
        console.log('Testing record creation...');
        
        const testRecord = await base('Orders').create([
            {
                "fields": {
                    "Customer Name": "Test Customer",
                    "Contact Info": "test@example.com",
                    "Pickup Day": "2025-08-10",
                    "Number of Loaves": 1,
                    "Order Date": new Date().toISOString().slice(0, 10),
                    "Status": "Test"
                }
            }
        ]);

        console.log('Test record created:', testRecord[0].id);

        // Clean up test record
        await base('Orders').destroy([testRecord[0].id]);
        console.log('Test record cleaned up');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                message: 'Airtable connection test successful',
                fieldsFound: records.length > 0 ? Object.keys(records[0].fields) : [],
                testRecordCreated: true
            })
        };

    } catch (error) {
        console.error('Airtable test failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Airtable test failed',
                details: error.message,
                stack: error.stack
            })
        };
    }
};