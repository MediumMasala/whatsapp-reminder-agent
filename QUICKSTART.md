# Quick Start Guide

Get your WhatsApp Reminder Agent running in 5 minutes.

## Prerequisites

- Node.js 20+ installed
- Docker & Docker Compose installed
- WhatsApp Business Account (get it at [business.facebook.com](https://business.facebook.com))

## Step 1: Clone & Setup

```bash
cd /path/to/project

# Install dependencies and setup services
make setup

# Or manually:
npm install
docker-compose up -d postgres redis
npm run prisma:generate
npm run prisma:migrate
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your WhatsApp credentials:

```env
# Get these from Meta Business Suite > WhatsApp > API Setup
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_secret_token_123
WHATSAPP_WEBHOOK_SECRET=my_webhook_secret_456
```

**Where to find these**:
1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to WhatsApp > API Setup
3. Copy Phone Number ID and Access Token
4. Create your own verify token (any random string)
5. Create your own webhook secret (any random string)

## Step 3: Start Development Server

```bash
make dev

# Or:
npm run dev
```

You should see:
```
[INFO] Database connected
[INFO] Reminder worker started
[INFO] Reminder scheduler started
[INFO] Server started successfully on port 3000
```

## Step 4: Expose Webhook (Development)

Use ngrok or similar to expose your local server:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

## Step 5: Configure WhatsApp Webhook

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to WhatsApp > Configuration > Webhook
3. Click "Edit"
4. Enter:
   - **Callback URL**: `https://abc123.ngrok.io/webhook`
   - **Verify Token**: Same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in .env
5. Click "Verify and Save"
6. Subscribe to **messages** field

## Step 6: Test!

Send a message to your WhatsApp Business number:

```
Remind me tomorrow at 9am to call doctor
```

You should receive:
```
✓ Reminder set!

📝 call doctor
⏰ Tomorrow at 9:00 AM
```

## Common Commands

```bash
make dev              # Start development server
make test             # Run tests
make docker-logs      # View database/redis logs
make prisma-studio    # Open database GUI
make docker-down      # Stop services
```

## Verify Setup

### Check Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-30T10:00:00.000Z"
}
```

### Check Database

```bash
make prisma-studio
```

Should open Prisma Studio at http://localhost:5555

### Check Logs

```bash
# Application logs
npm run dev

# Docker logs
make docker-logs
```

## Troubleshooting

### Webhook verification fails

1. Check verify token matches in .env and Meta dashboard
2. Ensure webhook URL is correct and accessible
3. Check ngrok is running

### Database connection error

```bash
# Check Postgres is running
docker ps | grep postgres

# Restart Postgres
docker-compose restart postgres
```

### Reminders not sending

1. Check Redis is running: `docker ps | grep redis`
2. Check worker logs for errors
3. Verify WhatsApp access token is valid

### Import errors

```bash
# Regenerate Prisma client
npm run prisma:generate

# Rebuild TypeScript
npm run build
```

## Next Steps

1. Read [README.md](./README.md) for full documentation
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. Explore the code in `src/`
4. Add custom conversational flows
5. Deploy to production

## Production Deployment

See [README.md](./README.md#production-deployment) for:
- Docker deployment
- Environment configuration
- Monitoring setup
- Security hardening

## Need Help?

Check logs:
```bash
# Application logs
make dev

# Docker logs
make docker-logs

# Database GUI
make prisma-studio
```

Happy coding! 🚀
