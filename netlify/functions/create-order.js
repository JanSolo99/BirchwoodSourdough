const Airtable = require('airtable');
const axios = require('axios');

// Rate limiting store (use Redis in production)
const orderAttempts = new Map();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_ORDERS_PER_WINDOW = 3;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://birchwood-sourdough.netlify.app'];

function getCORSHeaders(origin) {
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin) || 
    (process.env.NODE_ENV === 'development' && origin && origin.includes('localhost'));
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = orderAttempts.get(ip) || { count: 0, firstAttempt: now };
  
  // Clean up old entries
  if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
    orderAttempts.delete(ip);
    return false;
  }
  
  return attempts.count >= MAX_ORDERS_PER_WINDOW;
}

function recordOrderAttempt(ip) {
  const now = Date.now();
  const attempts = orderAttempts.get(ip) || { count: 0, firstAttempt: now };
  attempts.count++;
  attempts.lastAttempt = now;
  orderAttempts.set(ip, attempts);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().substring(0, 500); // Limit length and trim
}

function sanitizeForHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, (match) => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    };
    return entities[match];
  });
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validatePhoneNumber(phone) {
  const phoneRegex = /^[+]?[0-9\s\-\(\)]{8,20}$/;
  return phoneRegex.test(phone);
}

function logSecurityEvent(event, ip, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event} from ${ip}:`, details);
}

exports.handler = async function(event, context) {
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const origin = event.headers.origin;
    const headers = getCORSHeaders(origin);
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }
    
    if (event.httpMethod !== 'POST') {
        logSecurityEvent('INVALID_METHOD', clientIP, { method: event.httpMethod });
        return { 
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }) 
        };
    }
    
    // Rate limiting
    if (isRateLimited(clientIP)) {
        logSecurityEvent('ORDER_RATE_LIMITED', clientIP);
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ error: 'Too many orders attempted. Please wait before trying again.' })
        };
    }

    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        logSecurityEvent('MISSING_AIRTABLE_CONFIG', clientIP);
        return { 
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error' }) 
        };
    }
    
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    let orderData;
    try {
        orderData = JSON.parse(event.body);
    } catch (error) {
        logSecurityEvent('INVALID_JSON', clientIP);
        return { 
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid JSON in request body' }) 
        };
    }

    recordOrderAttempt(clientIP);
    
    let { customerName, contactInfo, pickupDay, pickupLocation, numLoaves, totalAmount } = orderData;
    
    // Sanitize inputs
    customerName = sanitizeInput(customerName);
    contactInfo = sanitizeInput(contactInfo);
    pickupLocation = sanitizeInput(pickupLocation);
    
    console.log('Received order data from', clientIP, ':', {
        customerName: sanitizeForHTML(customerName),
        contactInfo: contactInfo ? '***@***.***' : null, // Don't log contact info
        pickupDay,
        pickupLocation: sanitizeForHTML(pickupLocation),
        numLoaves,
        totalAmount
    });

    // Validate required fields
    if (!customerName || !contactInfo || !pickupDay || !numLoaves) {
        logSecurityEvent('MISSING_REQUIRED_FIELDS', clientIP, {
            hasName: !!customerName,
            hasContact: !!contactInfo,
            hasPickupDay: !!pickupDay,
            hasNumLoaves: !!numLoaves
        });
        return { 
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields: customerName, contactInfo, pickupDay, numLoaves' }) 
        };
    }
    
    // Additional input validation
    if (customerName.length > 100) {
        logSecurityEvent('INVALID_NAME_LENGTH', clientIP);
        return { 
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Customer name too long' }) 
        };
    }
    
    // Validate contact info format
    const isEmail = contactInfo.includes('@');
    const isPhone = /\d/.test(contactInfo) && !contactInfo.includes('@');
    
    if (!isEmail && !isPhone) {
        logSecurityEvent('INVALID_CONTACT_FORMAT', clientIP);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Contact info must be a valid email or phone number' })
        };
    }
    
    if (isEmail && !validateEmail(contactInfo)) {
        logSecurityEvent('INVALID_EMAIL', clientIP);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid email format' })
        };
    }
    
    if (isPhone && !validatePhoneNumber(contactInfo)) {
        logSecurityEvent('INVALID_PHONE', clientIP);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid phone number format' })
        };
    }

    // Make pickup location optional for now to prevent errors
    if (!pickupLocation) {
        console.log('Warning: No pickup location provided, using default');
    }

    // Validate date format and future date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(pickupDay)) {
        logSecurityEvent('INVALID_DATE_FORMAT', clientIP);
        return { 
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid pickup date format. Use YYYY-MM-DD' }) 
        };
    }
    
    const pickupDate = new Date(pickupDay);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (pickupDate < today) {
        logSecurityEvent('PAST_DATE_ORDER', clientIP, { date: pickupDay });
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Cannot place orders for past dates' })
        };
    }
    
    // Validate day of week (Tuesday, Wednesday, Thursday)
    const dayOfWeek = pickupDate.getDay();
    if (![2, 3, 4].includes(dayOfWeek)) {
        logSecurityEvent('INVALID_PICKUP_DAY', clientIP, { date: pickupDay, day: dayOfWeek });
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Pickup only available on Tuesday, Wednesday, or Thursday' })
        };
    }

    // Validate number of loaves
    if (!Number.isInteger(numLoaves) || numLoaves < 1 || numLoaves > 4) {
        logSecurityEvent('INVALID_LOAVES_COUNT', clientIP, { numLoaves });
        return { 
            statusCode: 400,
            headers,
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
            logSecurityEvent('INSUFFICIENT_STOCK', clientIP, { 
                requested: numLoaves, 
                available, 
                date: pickupDay 
            });
            return { 
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: `Not enough stock available. Only ${available} loaves remaining for ${pickupDay}` 
                }) 
            };
        }

        // Create the order record with backward compatibility
        const sanitizedName = customerName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        const orderReference = `BreadOrder-${sanitizedName}-${Date.now().toString().slice(-6)}`;
        const calculatedTotal = totalAmount || (numLoaves * 9); // Updated price
        
        // Start with basic fields that we know exist
        const fields = {
            "Customer Name": sanitizeForHTML(customerName),
            "Contact Info": contactInfo, // Don't sanitize - needed for communications
            "Pickup Day": pickupDay,
            "Number of Loaves": numLoaves,
            "Order Date": new Date().toISOString().slice(0, 10),
            "Status": "Pending Payment", // Set default status
            "Client IP": clientIP // For security tracking
        };

        // Add optional fields only if they have values
        if (pickupLocation) {
            fields["Pickup Location"] = sanitizeForHTML(pickupLocation);
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
          const emailResponse = await axios.post(`${process.env.URL || 'https://birchwood-sourdough.netlify.app'}/.netlify/functions/send-confirmation-email`, {
            customerName,
            contactInfo,
            pickupDay,
            pickupLocation,
            numLoaves,
            totalAmount: calculatedTotal,
            orderReference
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          console.log('Email confirmation sent successfully');
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError.message);
        }

        // Send confirmation SMS
        try {
          const smsResponse = await axios.post(`${process.env.URL || 'https://birchwood-sourdough.netlify.app'}/.netlify/functions/send-confirmation-sms`, {
            customerName,
            contactInfo,
            pickupDay,
            pickupLocation,
            numLoaves,
            totalAmount: calculatedTotal,
            orderReference
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          console.log('SMS confirmation sent successfully');
        } catch (smsError) {
          console.error('Error sending confirmation SMS:', smsError.message);
        }

        logSecurityEvent('ORDER_CREATED', clientIP, {
            orderId: createResponse[0].id,
            numLoaves,
            pickupDay,
            totalAmount: calculatedTotal
        });
        
        console.log(`Order created successfully: ${createResponse[0].id}`);
        console.log(`New order details: Customer=${sanitizeForHTML(customerName)}, Loaves=${numLoaves}, Date=${pickupDay}, Location=${sanitizeForHTML(pickupLocation) || 'TBD'}, Amount=A$${calculatedTotal}`);

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ 
                message: 'Order placed successfully - awaiting payment confirmation',
                orderId: createResponse[0].id,
                orderReference: orderReference,
                totalAmount: calculatedTotal
            })
        };

    } catch (error) {
        logSecurityEvent('ORDER_ERROR', clientIP, {
            error: error.message,
            name: error.name
        });
        console.error('Error creating order:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to place order',
                details: 'Internal server error' // Don't expose error details
            })
        };
    }
};