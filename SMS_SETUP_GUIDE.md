# SMS Integration Setup Guide

## 🎯 Overview
Your bread preorder app now supports SMS confirmations alongside email confirmations. The system automatically detects whether the contact info is an email or phone number and sends the appropriate confirmation.

## 📱 What's Been Added

### New Files:
- `send-confirmation-sms.js` - Sends initial order confirmation SMS
- `send-payment-confirmation-sms.js` - Sends payment received confirmation SMS

### Modified Files:
- `package.json` - Added Twilio dependency
- `create-order.js` - Added SMS confirmation after order creation
- `update-order-status.js` - Added SMS when payment is confirmed
- `.env.example` - Added Twilio environment variables

## 🚀 Setup Instructions

### 1. Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account
3. Verify your phone number
4. Get $15 USD free trial credit (about 300 SMS messages)

### 2. Get Twilio Credentials
1. In Twilio Console, go to Account > API keys & tokens
2. Note down your **Account SID** and **Auth Token**
3. Go to Phone Numbers > Manage > Active numbers
4. Buy an Australian phone number (+61) - costs ~$1.50 USD/month
5. Note down this phone number

### 3. Configure Environment Variables

#### In Netlify:
Go to Site settings > Environment variables and add:
```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here  
TWILIO_PHONE_NUMBER=+61xxxxxxxxx
```

#### For Local Development (.env file):
```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+61xxxxxxxxx
```

### 4. Install Dependencies
Run: `npm install` (this will install the new Twilio package)

### 5. Deploy to Netlify
Commit and push your changes, or trigger a new deploy in Netlify

## 💰 Cost Breakdown

### Twilio Pricing (AUD):
- **Setup**: Free (trial gives $15 USD credit)
- **Phone number**: ~$2 AUD/month
- **SMS messages**: ~$0.10 AUD per SMS
- **Estimated monthly cost**: $5-15 AUD (for 50-150 orders/month)

### Alternatives Considered:
- **AWS SNS**: $0.08 AUD/SMS (no phone number needed, but more complex setup)
- **MessageBird**: Similar pricing to Twilio
- **Vonage**: Similar pricing to Twilio

## 📋 How It Works

### For Email Orders:
- Customer enters email address
- System sends email confirmation with PayID details
- When you mark order as "Payment Received", system sends email confirmation

### For Phone Orders:
- Customer enters phone number (supports Australian formats)
- System sends SMS confirmation with PayID details  
- When you mark order as "Payment Received", system sends SMS confirmation

### Smart Detection:
- Contains "@" = Email → sends email only
- Contains numbers, no "@" = Phone → sends SMS only
- Invalid format = Creates order but skips confirmation

### Phone Number Formats Supported:
- `0412345678` → converts to `+61412345678`
- `+61412345678` → keeps as-is
- `61412345678` → converts to `+61412345678`

## 🔧 Testing

### Test SMS (during free trial):
1. Use your verified phone number as contact info
2. Place a test order
3. You should receive SMS confirmation

### Test Payment Confirmation:
1. Place order with phone number
2. Go to admin panel
3. Change order status to "Payment Received"
4. You should receive payment confirmation SMS

## 🚨 Important Notes

### Message Length:
- SMS is limited to 160 characters
- Long messages are split into multiple SMS (costs more)
- Current messages are optimized to stay under 160 characters

### Error Handling:
- If SMS fails, order still processes successfully
- Errors are logged but don't break the order flow
- Falls back gracefully if Twilio is not configured

### Security:
- Twilio credentials are stored as environment variables
- No sensitive data is logged in SMS messages
- Failed SMS attempts are logged for debugging

## 📈 Monitoring

### In Twilio Console:
- Monitor -> Logs -> SMS shows all sent messages
- Billing shows exact costs
- Debugger shows any failed messages

### In Netlify Functions:
- Functions tab shows SMS function execution logs
- Errors appear in function logs

## 🔄 Next Steps

1. **Test thoroughly** with your own phone number
2. **Monitor costs** in first month to adjust if needed  
3. **Consider adding** SMS for order ready notifications
4. **Optimize messages** if you hit character limits frequently

The SMS integration is now live and ready to use! 🎉