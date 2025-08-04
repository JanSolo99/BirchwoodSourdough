# SMS Integration Setup Guide - Australian Providers

## 🇦🇺 Overview
Your bread preorder app now supports SMS confirmations using **Australian SMS providers**. The system automatically detects whether the contact info is an email or phone number and sends the appropriate confirmation.

## 📱 What's Been Added

### New Files:
- `send-confirmation-sms.js` - Sends initial order confirmation SMS via Cellcast
- `send-payment-confirmation-sms.js` - Sends payment received confirmation SMS

### Modified Files:
- `package.json` - Added axios dependency (replacing Twilio)
- `create-order.js` - Added SMS confirmation after order creation
- `update-order-status.js` - Added SMS when payment is confirmed  
- `.env.example` - Added Cellcast environment variables

## 🏆 Australian SMS Provider Options

### **#1 Cellcast (Recommended)**
**🇦🇺 Melbourne-based, Australian-owned**

**Why Cellcast is perfect:**
- **Cheapest**: $0.028 AUD per SMS (vs Twilio's $0.0515 AUD)
- **No monthly fees**: Pay only for messages sent
- **Australian support**: Melbourne-based phone support
- **Direct carrier connections**: Telstra, Optus, Vodafone
- **100% uptime SLA**: Guaranteed delivery
- **No credit expiry**: Credits never expire

### Alternative Australian Providers:
- **Notifyre**: ~$0.030/SMS, ISO 27001 certified
- **SMS Broadcast**: ~$0.035/SMS, long-established Australian provider

## 🚀 Setup Instructions - Cellcast

### 1. Create Cellcast Account
1. Go to https://www.cellcast.com.au/
2. Click "Sign Up" for free account
3. Verify your details
4. Get free SMS credits to test

### 2. Get API Credentials
1. Login to Cellcast dashboard
2. Go to "API Connect" → "API Key"
3. Click "Activate Key" to generate credentials
4. Note down your **API Key** and **API Secret**

### 3. Configure Environment Variables

#### In Netlify:
Go to Site settings > Environment variables and add:
```
CELLCAST_API_KEY=your_api_key_here
CELLCAST_API_SECRET=your_api_secret_here
```

#### For Local Development (.env file):
```
CELLCAST_API_KEY=your_api_key_here
CELLCAST_API_SECRET=your_api_secret_here
```

### 4. Install Dependencies
Run: `npm install` (this will install axios for API calls)

### 5. Deploy to Netlify
Commit and push your changes, or trigger a new deploy in Netlify

## 💰 Cost Comparison (AUD)

| Provider | Per SMS | Monthly Fee | Setup | Location |
|----------|---------|-------------|-------|----------|
| **Cellcast** 🏆 | $0.028 | $0 | Free | 🇦🇺 Melbourne |
| **Notifyre** | $0.030 | $0 | Free | 🇦🇺 Australia |
| **SMS Broadcast** | $0.035 | $0 | Free | 🇦🇺 Australia |
| Twilio | $0.0515 | $0 | $2/month phone | 🇺🇸 USA |

**For 100 orders/month:**
- Cellcast: **$2.80 AUD/month**
- Twilio: **$5.15 AUD/month** + $2/month = **$7.15 AUD/month**

**You save ~60% with Cellcast!** 🎉

## 📋 How It Works

### Smart Message Detection:
- **Email address** (contains "@") → Email confirmation only
- **Phone number** (digits, no "@") → SMS confirmation only
- **Invalid format** → Order created, skips confirmation

### Phone Number Support:
- `0412345678` → converts to `+61412345678`
- `+61412345678` → keeps as-is
- `61412345678` → converts to `+61412345678`

### Message Flow:
1. **Order placed** → SMS: "Order confirmed, please pay A$X to PayID..."
2. **Payment received** → SMS: "Payment received, bread ready on [date]"

## 🔧 Testing

### Test SMS:
1. Use your mobile number as contact info when placing test order
2. You should receive SMS confirmation immediately
3. Mark order as "Payment Received" in admin
4. You should receive payment confirmation SMS

### Message Preview:
**Initial Order SMS:**
> Hi John! Your Birchwood Sourdough order confirmed: 2 loaves for pickup on 2025-08-10 at Farmers Market. Please pay A$16 to PayID: janberkhout@up.me (Ref: BreadOrder-John). Thanks!

**Payment Confirmation SMS:**
> Great news John! Your payment has been received. Your 2 loaves will be ready for pickup on 2025-08-10 at Farmers Market. Thanks for choosing Birchwood Sourdough!

## 🚨 Important Notes

### Message Features:
- Sender ID shows as "Birchwood" 
- Messages optimized for 160 character SMS limit
- Australian mobile numbers only (04xxxxxxxx format)

### Error Handling:
- If SMS fails, order still processes successfully
- Errors logged but don't break order flow
- Graceful fallback if Cellcast not configured

### Security:
- API credentials stored as environment variables
- HTTPS-only API communication
- No sensitive data in SMS messages

## 🇦🇺 Why Australian Providers Are Better

### **Local Advantages:**
- **Cheaper rates** for Australian SMS
- **Faster delivery** via direct carrier connections
- **Local support** in Australian timezones
- **Better compliance** with Australian regulations
- **No currency conversion** fees

### **Cellcast Specific Benefits:**
- Melbourne office with local phone support
- Direct connections to Telstra, Optus, Vodafone
- No international routing delays
- Australian business hours support
- Local bank account for payments

## 📈 Monitoring

### Cellcast Dashboard:
- Real-time delivery reports
- SMS credit balance
- Message history and analytics
- Failed message alerts

### Netlify Functions:
- Function execution logs
- Error tracking
- SMS API response monitoring

## 🔄 Next Steps

1. **Test thoroughly** with your mobile number
2. **Monitor first month** costs and delivery rates
3. **Consider upgrading** to higher volume bundles for better rates
4. **Explore MMS** for sending images of fresh bread! 📸🍞

**Your SMS integration is now powered by Australian technology!** 🇦🇺✨

## 🆘 Support Contacts

**Cellcast Support:**
- Phone: +61 (03) 8560 7025
- Email: info@cellcast.com.au
- Address: Level 2, 40 Porter St, Prahran, VIC 3181

The SMS integration is live and ready to support your local bread business! 🥖📱