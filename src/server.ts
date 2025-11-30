import express, { Request, Response } from 'express';
import { env } from './config/env';
import { logger } from './config/logger';
import { getPrismaClient, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
import { WebhookController } from './controllers/webhook.controller';
import { verifyWebhookSignature, handleWebhookVerification } from './middleware/webhook-verification';
import { ReminderWorker } from './jobs/reminder-worker';
import { ReminderScheduler } from './jobs/scheduler';

const app = express();

// Parse JSON bodies and preserve raw body for signature verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WhatsApp webhook endpoints
const webhookController = new WebhookController();

// Webhook verification (GET)
app.get('/webhook', (req: Request, res: Response) => {
  handleWebhookVerification(req, res);
});

// Webhook message handler (POST)
app.post(
  '/webhook',
  verifyWebhookSignature,
  (req: Request, res: Response) => webhookController.handleWebhook(req, res)
);

// Initialize background services
let reminderWorker: ReminderWorker;
let reminderScheduler: ReminderScheduler;

async function startServer() {
  try {
    // Validate database connection
    const prisma = getPrismaClient();
    await prisma.$connect();
    logger.info('Database connected');

    // Start reminder worker
    reminderWorker = new ReminderWorker();
    logger.info('Reminder worker started');

    // Start reminder scheduler
    reminderScheduler = new ReminderScheduler();
    reminderScheduler.start();
    logger.info('Reminder scheduler started');

    // Start Express server
    app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
        },
        'Server started successfully'
      );
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');

  try {
    // Stop scheduler
    if (reminderScheduler) {
      await reminderScheduler.close();
    }

    // Stop worker
    if (reminderWorker) {
      await reminderWorker.close();
    }

    // Close database
    await disconnectDatabase();

    // Close Redis
    await disconnectRedis();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  shutdown();
});

// Start the server
startServer();
