# WhatsApp Reminder Agent

A production-grade, WhatsApp-first reminder service built with full conversation memory, enabling context-aware interactions and future AI capabilities.

## Features

- **WhatsApp Cloud API Integration**: Secure send/receive via WhatsApp Business API
- **Full Conversation Memory**: Every message stored with metadata for context-aware flows
- **Natural Language Parsing**: Understand "tomorrow at 9am", "7pm today", etc.
- **Reliable Scheduling**: BullMQ-based job queue with retry logic
- **Context-Aware Responses**: Maintain conversation state across messages
- **Production Ready**: Docker, health checks, graceful shutdown, comprehensive logging

## Architecture

```
├── src/
│   ├── config/          # Environment, database, Redis, logging
│   ├── controllers/     # HTTP request handlers (webhook)
│   ├── services/        # Business logic
│   │   ├── user.service.ts
│   │   ├── reminder.service.ts
│   │   ├── conversation.service.ts    # Conversation memory engine
│   │   ├── whatsapp.service.ts
│   │   └── message-handler.service.ts # Conversational flows
│   ├── repositories/    # Database access layer
│   ├── jobs/            # BullMQ workers and schedulers
│   ├── middleware/      # Webhook verification
│   ├── utils/           # Reminder parser, helpers
│   └── types/           # TypeScript types
├── prisma/
│   └── schema.prisma    # Database schema
└── docker-compose.yml
```

## Database Schema

### Users
- Stores WhatsApp users with phone number, timezone, preferences

### Reminders
- Stores all reminders with status tracking (pending → sent → delivered/failed)
- Metadata stores parsed intent and original context

### Conversations (Critical Subsystem)
- **Every inbound and outbound message is logged**
- Stores:
  - Message text and direction
  - WhatsApp message IDs
  - Detected intent (create_reminder, list_reminders, etc.)
  - Extracted data (parsed time, date)
  - Active conversational flow
  - Related reminder ID

This enables:
- Context-aware responses ("You said 9am earlier")
- Multi-turn conversations
- Future AI features (summarization, insights)
- Dispute resolution / debugging

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- WhatsApp Business Account with Cloud API access

### 1. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your WhatsApp credentials:

```env
# WhatsApp Cloud API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
```

### 2. Start Services

```bash
# Start Postgres + Redis
docker-compose up -d postgres redis

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### 3. Configure WhatsApp Webhook

In your WhatsApp Business dashboard:

1. Set webhook URL: `https://your-domain.com/webhook`
2. Set verify token: (same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)
3. Subscribe to `messages` events

### 4. Test

Send a WhatsApp message to your business number:

```
Remind me tomorrow at 9am to call doctor
```

## Development

### Project Structure

```
src/
├── config/
│   ├── env.ts              # Environment validation with Zod
│   ├── logger.ts           # Pino logger
│   ├── database.ts         # Prisma client
│   └── redis.ts            # Redis/BullMQ connection
├── controllers/
│   └── webhook.controller.ts  # WhatsApp webhook handler
├── services/
│   ├── conversation.service.ts  # Conversation memory engine
│   ├── message-handler.service.ts  # Conversational flows
│   ├── reminder.service.ts
│   ├── user.service.ts
│   └── whatsapp.service.ts
├── repositories/
│   ├── conversation.repository.ts
│   ├── reminder.repository.ts
│   └── user.repository.ts
├── jobs/
│   ├── reminder-queue.ts     # BullMQ queue
│   ├── reminder-worker.ts    # Worker process
│   └── scheduler.ts          # Periodic check for pending reminders
├── utils/
│   └── reminder-parser.ts    # Natural language parsing
└── server.ts
```

### Available Scripts

```bash
npm run dev          # Start with hot reload (tsx watch)
npm run build        # Build TypeScript
npm start            # Start production server
npm test             # Run tests
npm run test:watch   # Run tests in watch mode

npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio

npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
npm run docker:logs  # View logs
```

## Conversation Memory System

The conversation service is a first-class subsystem that stores every message:

```typescript
// Store inbound message
await conversationService.storeMessage({
  userId: user.id,
  direction: 'inbound',
  messageText: 'Remind me at 7pm',
  whatsappMessageId: msg.id,
  detectedIntent: 'create_reminder',
  extractedData: { time: '7pm' },
});

// Get context for smart responses
const context = await conversationService.getContext(user.id);
// Returns: recent messages, last intent, active flow
```

This enables:

- **Context-aware flows**: "You asked about rent earlier"
- **Multi-turn conversations**: Continue partial reminders
- **AI features**: Train models on conversation history
- **Analytics**: User behavior, popular times, etc.

## Natural Language Parsing

Supported formats:

```
✓ "tomorrow at 9am"
✓ "7pm today"
✓ "tomorrow morning"
✓ "tomorrow evening"
✓ "5:30pm"
✓ "Remind me at 7pm to pay rent"
✓ "Call doctor tomorrow at 10am"
```

Parser extracts:
- Time (with AM/PM conversion)
- Date (today/tomorrow)
- Reminder text (cleaned)

## WhatsApp Integration

### Sending Messages

```typescript
const result = await whatsappService.sendTextMessage({
  to: '+919876543210',
  message: 'Your reminder: Pay rent',
});
```

### Security

- Webhook signature verification (HMAC SHA256)
- Webhook verify token check
- Secure environment variable handling

### Rate Limiting

BullMQ worker configured with:
- Max 10 messages per second
- Exponential backoff on failures
- 3 retry attempts

## Reminder Scheduling

### How it works

1. **User creates reminder** → Stored in database
2. **Scheduler checks** every 30s for pending reminders
3. **Queue jobs** for reminders due in next hour
4. **Worker processes** at exact scheduled time
5. **Send via WhatsApp** → Update status
6. **Store in conversation** history

### Status Flow

```
pending → sent → delivered
         ↓
       failed (with retry)
```

### Idempotency

- Job ID = Reminder ID (prevents duplicates)
- Status checks before sending
- Graceful handling of cancelled reminders

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test reminder-parser
```

Test coverage:
- Reminder parser (time extraction, text cleaning)
- Conversation service (context retrieval, flow detection)
- Integration tests for core flows

## Production Deployment

### Using Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Environment Variables (Production)

```env
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-redis-password
```

### Monitoring

- Health check endpoint: `GET /health`
- Structured JSON logging (Pino)
- Graceful shutdown handling (SIGTERM/SIGINT)

## WhatsApp Business Setup

### 1. Create Business Account

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Create WhatsApp Business App
3. Get Phone Number ID and Access Token

### 2. Configure Webhook

- URL: `https://your-domain.com/webhook`
- Verify Token: Set in `.env`
- Subscribe to: `messages`

### 3. Message Templates

For messages outside 24-hour window, create templates:

```typescript
await whatsappService.sendTemplateMessage(
  phoneNumber,
  'reminder_notification',
  [reminderText]
);
```

## Future Enhancements

### AI-Powered Features (Enabled by Conversation Memory)

- **Smart Scheduling**: Learn user preferences from history
- **Context Summarization**: "You have 3 rent reminders this month"
- **Intent Prediction**: Predict next action based on patterns
- **Personalization**: Adapt message style to user preferences

### Additional Features

- Recurring reminders (daily, weekly, monthly)
- Location-based reminders
- Reminder categories and tags
- Voice message support
- Multi-language support
- Analytics dashboard

## API Reference

### Webhook Endpoints

#### `GET /webhook`
Webhook verification for WhatsApp

**Query Parameters:**
- `hub.mode`: "subscribe"
- `hub.verify_token`: Your verify token
- `hub.challenge`: Challenge string

#### `POST /webhook`
Receive WhatsApp messages and status updates

**Headers:**
- `x-hub-signature-256`: HMAC SHA256 signature

**Body:** WhatsApp webhook payload

### Health Check

#### `GET /health`
Returns server health status

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-30T10:00:00.000Z"
}
```

## Troubleshooting

### Messages not receiving

1. Check webhook verification: `GET /webhook` should return challenge
2. Verify signature secret matches
3. Check WhatsApp dashboard for webhook errors

### Reminders not sending

1. Check BullMQ worker is running: `docker-compose logs app`
2. Verify Redis connection
3. Check reminder status in database
4. Review logs for API errors

### Database connection issues

```bash
# Check Postgres is running
docker-compose ps postgres

# Connect to database
npm run prisma:studio
```

## License

MIT

## Support

For issues and questions, check logs:

```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs postgres

# Redis logs
docker-compose logs redis
```
