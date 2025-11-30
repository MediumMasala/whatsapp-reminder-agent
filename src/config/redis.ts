import IORedis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: IORedis;

export function getRedisClient(): IORedis {
  if (!redisClient) {
    // Railway provides REDIS_URL, local uses REDIS_HOST/PORT
    if (env.REDIS_URL) {
      redisClient = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } else {
      redisClient = new IORedis({
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT || 6379,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    }

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
    });
  }

  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}
