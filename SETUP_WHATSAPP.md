# WhatsApp Setup Guide - Internal Testing

Complete guide to connect your reminder agent to a WhatsApp number for testing.

---

## 🎯 Overview

We'll:
1. Create a Meta (Facebook) Business Account
2. Set up WhatsApp Business API
3. Get a test phone number (FREE from Meta)
4. Get API credentials
5. Run the app locally with ngrok
6. Configure the webhook
7. Test with real WhatsApp messages

**Time needed**: ~30 minutes

---

## Step 1: Create Meta Business Account

### 1.1 Go to Meta for Developers
Visit: https://developers.facebook.com/

### 1.2 Create Account
- Click "Get Started" (top right)
- Log in with your Facebook account (or create one)
- Complete the registration

### 1.3 Create a Business App
1. Click "My Apps" → "Create App"
2. Select **"Business"** as the app type
3. Fill in:
   - **App Name**: "Reminder Agent Test" (or any name)
   - **App Contact Email**: your email
   - **Business Account**: Create new or select existing
4. Click "Create App"

---

## Step 2: Add WhatsApp Product

### 2.1 Add WhatsApp to Your App
1. In your app dashboard, find **"WhatsApp"** in the product list
2. Click "Set Up"

### 2.2 Get a Test Phone Number (FREE)
Meta provides a **free test number** you can use immediately:

1. You'll see "Start using the API" screen
2. Under **"From"**, you'll see a phone number (e.g., +1 555 0100)
   - This is your **WhatsApp Business number** (free for testing)
3. Copy this number - this is where users will send messages

### 2.3 Add Your Personal Number for Testing
1. Under **"To"**, click "Manage phone number list"
2. Click "Add phone number"
3. Enter your personal WhatsApp number (with country code)
   - Example: +919876543210
4. You'll receive a verification code on WhatsApp
5. Enter the code to verify

**Important**: In test mode, you can only message numbers you've added here (up to 5 numbers for free testing).

---

## Step 3: Get API Credentials

### 3.1 Get Temporary Access Token
1. In WhatsApp > API Setup page, find **"Temporary access token"**
2. Click "Copy"
3. Save this - you'll add it to `.env` as `WHATSAPP_ACCESS_TOKEN`

**Note**: This token expires in 24 hours. For long-term testing, we'll get a permanent token later.

### 3.2 Get Phone Number ID
1. On the same page, find **"Phone number ID"**
2. Copy this long numeric ID (not the phone number itself)
3. Save this - you'll add it to `.env` as `WHATSAPP_PHONE_NUMBER_ID`

### 3.3 Get WhatsApp Business Account ID
1. In the left sidebar, click "WhatsApp" → "Getting Started"
2. Look for **"WhatsApp Business Account ID"**
3. Copy this ID
4. Save this - you'll add it to `.env` as `WHATSAPP_BUSINESS_ACCOUNT_ID`

---

## Step 4: Set Up Local Environment

### 4.1 Navigate to Project
```bash
cd "/Users/yashshah/Desktop/Claude Project/V1"
```

### 4.2 Create .env File
```bash
cp .env.example .env
```

### 4.3 Edit .env File
Open `.env` and fill in these values:

```env
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database (use default for local testing)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsapp_reminder?schema=public

# Redis (use default for local testing)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp Cloud API - FILL THESE IN
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID_HERE
WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_BUSINESS_ACCOUNT_ID_HERE
WHATSAPP_ACCESS_TOKEN=YOUR_TEMPORARY_ACCESS_TOKEN_HERE

# Webhook Security - CREATE YOUR OWN
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_super_secret_verify_token_12345
WHATSAPP_WEBHOOK_SECRET=my_super_secret_webhook_secret_67890

# App Settings (default is fine)
DEFAULT_TIMEZONE=Asia/Kolkata
REMINDER_CHECK_INTERVAL_MS=30000
MAX_CONVERSATION_HISTORY=100
```

**Important**:
- For `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `WHATSAPP_WEBHOOK_SECRET`:
  - Create your own random strings (any text you want)
  - Keep them secret
  - You'll use verify token when setting up webhook

### 4.4 Install Dependencies
```bash
npm install
```

### 4.5 Start Docker Services
```bash
# Start Postgres and Redis
docker-compose up -d postgres redis

# Wait a few seconds for them to start
sleep 5
```

### 4.6 Set Up Database
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

You should see:
```
✔ Generated Prisma Client
✔ Database migrations applied
```

---

## Step 5: Expose Local Server with Ngrok

Your local server needs to be accessible from the internet for WhatsApp to send webhooks.

### 5.1 Install Ngrok
Visit: https://ngrok.com/download

Or with Homebrew:
```bash
brew install ngrok/ngrok/ngrok
```

### 5.2 Sign Up for Ngrok (Free)
1. Go to https://dashboard.ngrok.com/signup
2. Sign up (free account works fine)
3. Copy your auth token from dashboard

### 5.3 Authenticate Ngrok
```bash
ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
```

### 5.4 Start Your App
```bash
npm run dev
```

You should see:
```
[INFO] Database connected
[INFO] Reminder worker started
[INFO] Reminder scheduler started
[INFO] Server started successfully on port 3000
```

### 5.5 In a New Terminal, Start Ngrok
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123xyz.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123xyz.ngrok-free.app`)

⚠️ **Important**:
- Keep this terminal open - closing it stops ngrok
- Free ngrok URLs change each time you restart
- Your URL will be different than the example

---

## Step 6: Configure WhatsApp Webhook

### 6.1 Go to WhatsApp Configuration
1. In Meta App Dashboard, go to WhatsApp > Configuration
2. Find the "Webhook" section
3. Click "Edit"

### 6.2 Enter Webhook Details
1. **Callback URL**: `https://YOUR_NGROK_URL/webhook`
   - Example: `https://abc123xyz.ngrok-free.app/webhook`
   - Make sure to add `/webhook` at the end

2. **Verify Token**: Enter the same value you used in `.env` for `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Example: `my_super_secret_verify_token_12345`

3. Click "Verify and Save"

✅ You should see "Success" message

### 6.3 Subscribe to Webhook Fields
1. Still in Configuration page, scroll to "Webhook fields"
2. Click "Manage" next to "messages"
3. Check the box for **"messages"**
4. Click "Save"

---

## Step 7: Test Your Reminder Agent! 🎉

### 7.1 Send Your First Message
On your personal WhatsApp (the number you verified earlier):

1. Add the Meta test number to your contacts (optional)
2. Send a message to the test number:

```
Hello
```

You should receive:
```
I'm not sure what you mean. Try:

• Setting a reminder: "Tomorrow at 9am call doctor"
• Viewing reminders: "List my reminders"
• Getting help: "Help"
```

### 7.2 Create a Reminder
Send:
```
Remind me tomorrow at 9am to call doctor
```

You should receive:
```
✓ Reminder set!

📝 call doctor
⏰ Tomorrow at 9:00 AM
```

### 7.3 List Reminders
Send:
```
List my reminders
```

You should see:
```
Your upcoming reminders:

1. call doctor
   ⏰ Tomorrow at 9:00 AM
```

### 7.4 Test Other Formats
Try these:

```
Pay rent at 7pm
```

```
Tomorrow evening call mom
```

```
Remind me at 5:30pm to workout
```

### 7.5 Test Help
Send:
```
Help
```

---

## Step 8: Monitor & Debug

### 8.1 Watch Logs
In your terminal running `npm run dev`, you'll see:

```
[INFO] Received webhook
[INFO] Processing incoming message { phoneNumber: '+919876543210', messageText: 'Remind me...' }
[INFO] Finding or creating user
[INFO] Storing conversation message
[INFO] Handling user message
[INFO] Creating reminder
[INFO] Reminder scheduled in queue
```

### 8.2 Check Database
Open Prisma Studio to see data:
```bash
make prisma-studio
# Or: npm run prisma:studio
```

Opens at http://localhost:5555

You can browse:
- **Users**: Your WhatsApp number
- **Reminders**: All created reminders
- **Conversations**: Every message (inbound + outbound)

### 8.3 Check Redis Queue
```bash
# Connect to Redis
docker exec -it whatsapp-reminder-redis redis-cli

# List all keys
KEYS *

# Check queue length
LLEN bull:reminders:wait

# Exit
exit
```

---

## Step 9: Wait for Your Reminder! ⏰

### 9.1 Create a Quick Test Reminder
To test immediately, create a reminder 2 minutes from now:

```
Remind me at [CURRENT_TIME + 2 minutes] to test this
```

For example, if it's 3:00 PM now:
```
Remind me at 3:02pm to test this
```

### 9.2 Watch the Logs
In 2 minutes, you should see:
```
[INFO] Processing reminder { reminderId: '...', userId: '...' }
[INFO] Reminder sent successfully
```

And receive on WhatsApp:
```
🔔 Reminder:

test this
```

---

## Troubleshooting

### Issue: Webhook Verification Failed

**Check**:
1. Ngrok is running and URL is correct
2. Your app is running (`npm run dev`)
3. Verify token in `.env` matches exactly what you entered in Meta dashboard
4. URL ends with `/webhook`

**Test manually**:
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=my_super_secret_verify_token_12345&hub.challenge=test123"
```

Should return: `test123`

### Issue: Not Receiving Messages

**Check**:
1. Your personal number is verified in Meta dashboard
2. You're messaging the correct test number
3. Webhook is subscribed to "messages" field
4. Check app logs for errors

**Test webhook**:
```bash
curl http://localhost:3000/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Issue: Messages Send But No Response

**Check app logs**:
```bash
# Look for errors
npm run dev
```

**Check database connection**:
```bash
make prisma-studio
```

**Check Redis**:
```bash
docker ps | grep redis
```

### Issue: Reminders Not Sending

**Check**:
1. Worker is running (logs show "Reminder worker started")
2. Redis is running: `docker ps | grep redis`
3. Reminder is in database with status "pending"
4. Check scheduled time is in future

**View queue**:
```bash
make prisma-studio
# Check reminders table, look at status and scheduled_time
```

### Issue: Access Token Expired

The temporary token expires in 24 hours. To get a long-term token:

1. Go to Meta App Dashboard
2. WhatsApp > Getting Started
3. Find "Generate a permanent token" section
4. Follow instructions to generate system user token
5. Update `.env` with new token
6. Restart app

---

## Step 10: Advanced Testing

### Test Conversation Context
Try this flow:

```
You: "Remind me to pay rent"
Bot: "I couldn't understand the time..."
You: "Tomorrow at 9am"
Bot: Creates reminder with text "pay rent" from context
```

### Test Multiple Reminders
```
Remind me at 5pm to call doctor
Remind me tomorrow at 9am to pay rent
Remind me at 7:30pm to workout
List my reminders
```

### Test Natural Language
Try different formats:
- "tomorrow morning call mom"
- "tomorrow evening pay bills"
- "7pm workout"
- "tomorrow at 10am meeting"

---

## Production Readiness (Later)

For production use:

### 1. Get Permanent Access Token
- Follow Meta's guide to create system user token
- This token doesn't expire

### 2. Verify Your Business
- Submit business verification to Meta
- Required to message unlimited numbers

### 3. Create Message Templates
- For messages outside 24-hour window
- Submit templates for approval

### 4. Deploy to Production Server
- Use a real domain (not ngrok)
- Set up SSL certificate
- Configure environment variables
- Use managed database and Redis

### 5. Scale
- Add more workers
- Use load balancer
- Set up monitoring

---

## Quick Command Reference

```bash
# Start everything
make setup           # First time only
make dev            # Start app

# In another terminal
ngrok http 3000     # Expose webhook

# Monitor
make docker-logs    # View DB/Redis logs
make prisma-studio  # View database

# Test
curl http://localhost:3000/health

# Stop
Ctrl+C              # Stop app
docker-compose down # Stop DB/Redis
```

---

## Next Steps

✅ **You're now testing internally!**

Try:
1. Add 4 more phone numbers for your team
2. Create various reminders
3. Test edge cases (past times, invalid formats)
4. Check conversation history in database
5. Monitor logs for any errors

When ready for production:
- Read [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- Set up proper domain and hosting
- Get permanent access token
- Verify your business with Meta

---

## Support

**Check logs**:
```bash
npm run dev          # App logs
make docker-logs     # Infrastructure logs
```

**Database GUI**:
```bash
make prisma-studio
```

**Health check**:
```bash
curl http://localhost:3000/health
```

Happy testing! 🚀
