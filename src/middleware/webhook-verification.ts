import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Verify WhatsApp webhook signature
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function verifyWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    logger.warn('Missing webhook signature');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac('sha256', env.WHATSAPP_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignatureWithPrefix)
  )) {
    logger.warn({ signature }, 'Invalid webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  logger.debug('Webhook signature verified');
  next();
}

/**
 * Handle webhook verification challenge
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function handleWebhookVerification(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.status(403).json({ error: 'Verification failed' });
  }
}
