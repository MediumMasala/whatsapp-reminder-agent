# Architecture Documentation

## System Overview

WhatsApp Reminder Agent is a production-grade backend service that enables users to create and manage reminders entirely via WhatsApp. The system is built around three core principles:

1. **WhatsApp-First**: All interactions happen on WhatsApp
2. **Full Conversation Memory**: Every message is stored for context-aware flows
3. **Reliable Scheduling**: Reminders are never missed or double-sent

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WhatsApp Cloud API                       │
└────────────┬─────────────────────────────────────┬──────────────┘
             │ Inbound Messages                     │ Outbound Messages
             │                                      │
             ▼                                      ▲
┌─────────────────────────────────────────────────────────────────┐
│                      Express HTTP Server                         │
│                                                                   │
│  ┌──────────────────┐    ┌────────────────────────────────────┐│
│  │ Webhook Handler  │───▶│   Message Handler Service          ││
│  │ (POST /webhook)  │    │   - Intent detection               ││
│  └──────────────────┘    │   - Conversation routing           ││
│                           │   - Response generation            ││
│                           └────────────────────────────────────┘│
└────────────┬──────────────────────────────────────┬─────────────┘
             │                                       │
             ▼                                       ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│  Conversation Memory    │           │   Reminder Management   │
│  - Store every message  │           │   - Parse NL input      │
│  - Track intent/flow    │           │   - Create reminders    │
│  - Retrieve context     │           │   - Schedule jobs       │
└────────────┬────────────┘           └───────────┬─────────────┘
             │                                     │
             ▼                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Users    │  │  Reminders   │  │    Conversations        │ │
│  └────────────┘  └──────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

                              ┌─────────────────────────────────┐
                              │        Redis + BullMQ           │
                              │  - Job queue for reminders      │
                              │  - Scheduled execution          │
                              │  - Retry logic                  │
                              └────────┬────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────────────────────┐
                              │     Reminder Worker             │
                              │  - Process jobs at exact time   │
                              │  - Send WhatsApp messages       │
                              │  - Update reminder status       │
                              └─────────────────────────────────┘
```

## Core Subsystems

### 1. Conversation Memory Engine

**Purpose**: Store and retrieve every WhatsApp message for context-aware interactions

**Components**:
- `ConversationRepository`: Database access
- `ConversationService`: Business logic

**Key Features**:
- Every inbound/outbound message is logged
- Stores metadata: intent, extracted data, active flow
- Enables context retrieval for smart responses
- Links conversations to reminders

**Use Cases**:
- "You asked about rent earlier - do you want to complete that reminder?"
- Multi-turn conversations: User → "Remind me to pay rent" → Bot → "When?" → User → "Tomorrow at 9am"
- Analytics: User behavior patterns
- AI training data

**Database Fields**:
```typescript
{
  userId: string
  direction: 'inbound' | 'outbound'
  messageText: string
  whatsappMessageId: string
  detectedIntent: 'create_reminder' | 'list_reminders' | ...
  extractedData: { time, date, ... }
  activeFlow: string
  relatedReminderId: string
  timestamp: Date
}
```

### 2. WhatsApp Integration Layer

**Purpose**: Secure send/receive via WhatsApp Cloud API

**Components**:
- `WhatsAppService`: API client
- `WebhookController`: Webhook handler
- `webhook-verification` middleware: Security

**Key Features**:
- Signature verification (HMAC SHA256)
- Message sending with retry
- Status tracking (sent/delivered/failed)
- Rate limiting (10 msg/sec)

**Security**:
```typescript
// Verify webhook signature
const signature = req.headers['x-hub-signature-256'];
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(req.body))
  .digest('hex');
```

**Message Flow**:
1. WhatsApp → POST /webhook → Signature verification
2. Extract message → Find/create user
3. Store in conversation history
4. Route to message handler → Send response
5. Store outbound message in conversation

### 3. Message Handler & Conversational Flows

**Purpose**: Orchestrate user interactions and responses

**Components**:
- `MessageHandler`: Core routing logic
- `ReminderParser`: Natural language understanding

**Intent Detection**:
```typescript
detectIntent(message: string): DetectedIntent {
  if (/list|show|my reminders/.test(message)) return 'list_reminders';
  if (/cancel|delete|remove/.test(message)) return 'cancel_reminder';
  if (this.parser.isReminderRequest(message)) return 'create_reminder';
  return 'unknown';
}
```

**Context-Aware Responses**:
```typescript
// Get recent conversation context
const context = await conversationService.getContext(userId);

// If user says "9am" without context, check if they were creating a reminder
if (context.lastIntent === 'create_reminder') {
  // Continue reminder creation flow
}
```

### 4. Reminder Scheduling Engine

**Purpose**: Reliable, idempotent reminder execution

**Components**:
- `ReminderQueue`: BullMQ queue wrapper
- `ReminderWorker`: Job processor
- `ReminderScheduler`: Periodic checker

**Flow**:

1. **User creates reminder** →
   - Parse natural language
   - Store in database (status: pending)
   - Queue job with delay

2. **Scheduler runs every 30s** →
   - Find pending reminders due in next hour
   - Schedule jobs (handles restarts)

3. **Worker processes job** →
   - Check reminder still pending
   - Send WhatsApp message
   - Update status to 'sent'
   - Store in conversation history

**Idempotency**:
- Job ID = Reminder ID (prevents duplicates)
- Status check before sending
- Handle cancelled reminders gracefully

**Retry Logic**:
```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
}
```

### 5. Natural Language Parser

**Purpose**: Extract reminder details from casual messages

**Supported Patterns**:
- Time: "7pm", "5:30pm", "morning", "evening"
- Date: "today", "tomorrow"
- Combined: "tomorrow at 9am", "7pm today"

**Parsing Logic**:
```typescript
parse(message: string): ParsedReminder {
  const time = extractTime(message);  // → { hours: 19, minutes: 0 }
  const date = extractDate(message);  // → { daysFromNow: 1 }
  const text = extractReminderText(message);  // → "pay rent"

  return {
    text,
    scheduledTime: buildDateTime(date, time),
    extractedData: { ... }
  };
}
```

**Smart Time Handling**:
- If time is in the past → Assume tomorrow
- Default to today if no date specified
- Timezone-aware (Asia/Kolkata)

## Data Flow Examples

### Creating a Reminder

```
1. User sends: "Remind me tomorrow at 9am to call doctor"
   ↓
2. Webhook receives → Verify signature → Parse payload
   ↓
3. Find/create user in database
   ↓
4. Store inbound message in conversations table
   {
     direction: 'inbound',
     messageText: 'Remind me tomorrow...',
     detectedIntent: 'create_reminder',
     extractedData: { time: '9am', date: 'tomorrow' }
   }
   ↓
5. Parse reminder:
   - text: "call doctor"
   - scheduledTime: 2025-01-31 09:00:00+05:30
   ↓
6. Create reminder in database (status: pending)
   ↓
7. Schedule BullMQ job (delay = scheduledTime - now)
   ↓
8. Send confirmation message
   "✓ Reminder set!
    📝 call doctor
    ⏰ Tomorrow at 9:00 AM"
   ↓
9. Store outbound message in conversations table
   {
     direction: 'outbound',
     messageText: '✓ Reminder set!...',
     relatedReminderId: 'reminder-123'
   }
```

### Sending a Reminder

```
1. BullMQ job triggers at scheduled time
   ↓
2. Worker receives job { reminderId, userId, phoneNumber, text }
   ↓
3. Check reminder status = 'pending' (idempotency)
   ↓
4. Send WhatsApp message
   "🔔 Reminder:

    call doctor"
   ↓
5. Update reminder status to 'sent', store messageId
   ↓
6. Store outbound message in conversations table
   {
     direction: 'outbound',
     messageText: '🔔 Reminder: call doctor',
     relatedReminderId: 'reminder-123'
   }
   ↓
7. Job complete (or retry on failure)
```

### Context-Aware Response

```
1. User sends: "Remind me to pay rent"
   ↓
2. Parser detects: Missing time information
   ↓
3. Send response: "When should I remind you?"
   ↓
4. Store both messages in conversations with:
   activeFlow: 'create_reminder_incomplete'
   ↓
5. User sends: "Tomorrow at 9am"
   ↓
6. Get conversation context:
   - lastIntent: 'create_reminder'
   - partialReminderText: 'pay rent'
   ↓
7. Combine context:
   - text: "pay rent" (from context)
   - time: "9am tomorrow" (from current message)
   ↓
8. Create complete reminder
```

## Database Design

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  timezone VARCHAR DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- `phone_number` (unique lookup)

### Reminders Table
```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reminder_text TEXT NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  status VARCHAR DEFAULT 'pending',  -- pending|sent|delivered|failed|cancelled
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failure_reason TEXT,
  whatsapp_msg_id VARCHAR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- `(user_id, status)` - Fast user queries
- `(scheduled_time, status)` - Scheduler queries

### Conversations Table (CRITICAL)
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  direction VARCHAR NOT NULL,  -- inbound|outbound
  message_text TEXT NOT NULL,
  whatsapp_message_id VARCHAR,
  timestamp TIMESTAMP DEFAULT NOW(),
  detected_intent VARCHAR,     -- create_reminder|list_reminders|etc
  extracted_data JSONB,        -- { time, date, ... }
  active_flow VARCHAR,         -- Which conversation flow
  related_reminder_id UUID,    -- Link to reminder if applicable
  metadata JSONB
);
```

**Indexes**:
- `(user_id, timestamp DESC)` - Recent messages
- `(user_id, active_flow)` - Active conversations
- `detected_intent` - Analytics

## Configuration

### Environment Variables

**Required**:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `WHATSAPP_ACCESS_TOKEN`: API token
- `WHATSAPP_PHONE_NUMBER_ID`: Business phone number
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Webhook verification
- `WHATSAPP_WEBHOOK_SECRET`: Signature verification

**Optional**:
- `DEFAULT_TIMEZONE`: Default timezone (Asia/Kolkata)
- `REMINDER_CHECK_INTERVAL_MS`: Scheduler interval (30000)
- `MAX_CONVERSATION_HISTORY`: Context limit (100)
- `LOG_LEVEL`: Logging level (info)

### BullMQ Configuration

```typescript
{
  defaultJobOptions: {
    attempts: 3,              // Retry 3 times
    backoff: {
      type: 'exponential',
      delay: 2000            // Start with 2s, then 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600,        // Keep 24 hours
      count: 1000
    }
  },
  limiter: {
    max: 10,                 // Max 10 jobs
    duration: 1000           // Per second
  }
}
```

## Scalability Considerations

### Horizontal Scaling

**Stateless Design**:
- Express server is stateless
- Can run multiple instances behind load balancer

**Job Queue**:
- BullMQ naturally supports multiple workers
- Workers can run on separate processes/machines

**Database**:
- Postgres supports read replicas
- Connection pooling with Prisma

### Performance Optimizations

**Database Queries**:
- Indexed queries for fast lookups
- Limit conversation history queries (configurable)
- Efficient reminder scheduling queries

**Caching**:
- User data can be cached in Redis
- Conversation context caching (future)

**Rate Limiting**:
- WhatsApp API: 10 msg/sec (BullMQ limiter)
- Webhook processing: Async after 200 OK

## Error Handling

### Graceful Degradation

**WhatsApp API Failures**:
- Retry with exponential backoff
- Mark reminder as failed after 3 attempts
- Store error in database for debugging

**Database Failures**:
- Connection retry logic in Prisma
- Graceful shutdown on persistent failures

**Worker Crashes**:
- Jobs remain in Redis queue
- Scheduler re-queues pending reminders
- No message loss

### Monitoring

**Structured Logging**:
```typescript
logger.info({
  reminderId,
  userId,
  scheduledTime
}, 'Reminder created');
```

**Health Checks**:
- `GET /health` endpoint
- Database connectivity check
- Redis connectivity check

## Security

### WhatsApp Webhook Security

1. **Signature Verification**:
   - HMAC SHA256 with secret
   - Constant-time comparison

2. **Verify Token**:
   - Random token for webhook setup
   - Prevents unauthorized webhook registration

### Data Security

- Environment variables for secrets
- No secrets in code/logs
- Database encryption at rest (PostgreSQL)
- TLS for API communication

### User Privacy

- Phone numbers as unique identifiers
- Conversation history stored securely
- GDPR-compliant (user deletion cascade)

## Future Architecture Enhancements

### AI Integration

**Enabled by Conversation Memory**:
- Train LLM on conversation patterns
- Smart intent prediction
- Personalized response generation
- Conversation summarization

### Advanced Features

**Recurring Reminders**:
- Cron-like scheduling
- Pattern detection from history

**Multi-language**:
- Language detection from messages
- Localized responses

**Analytics Pipeline**:
- Stream conversations to analytics DB
- User behavior insights
- Reminder effectiveness metrics

### Infrastructure

**Kubernetes Deployment**:
- Separate pods for API, workers
- Auto-scaling based on queue depth

**Message Broker**:
- Consider Kafka for high-volume events
- Separate event stream for analytics

**CDN**:
- Cache static assets
- Reduce latency for global users
