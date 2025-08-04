const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async (event) => {
    try {
        const { name, email, feedback, rating } = JSON.parse(event.body);

        await base('Feedback').create([
            {
                fields: {
                    'Name': name,
                    'Email': email,
                    'Feedback': feedback,
                    'Rating': parseInt(rating, 10),
                },
            },
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Feedback submitted successfully' }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to submit feedback' }),
        };
    }
};