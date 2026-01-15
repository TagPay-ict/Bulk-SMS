import Redis from 'ioredis';
import { logger } from './logger.js';

// Parse Redis URL to extract connection details
function parseRedisUrl(url) {
  if (!url) {
    return { host: 'localhost', port: 6379, tls: false };
  }

  // Check if it's a TLS connection (rediss://)
  const isTLS = url.startsWith('rediss://');
  const cleanUrl = url.replace(/^rediss?:\/\//, '');

  // Extract password and host
  const [authPart, hostPart] = cleanUrl.split('@');
  
  const baseConfig = {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableReadyCheck: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    lazyConnect: false,
  };

  if (hostPart) {
    // Has password
    const [username, password] = authPart.split(':');
    const [host, port] = hostPart.split(':');
    
    return {
      ...baseConfig,
      host: host,
      port: parseInt(port || '6379', 10),
      password: password,
      username: username !== 'default' ? username : undefined,
      tls: isTLS ? {
        // TLS configuration for Upstash/cloud Redis
        rejectUnauthorized: true,
      } : undefined,
    };
  } else {
    // No password
    const [host, port] = cleanUrl.split(':');
    return {
      ...baseConfig,
      host: host,
      port: parseInt(port || '6379', 10),
      tls: isTLS ? {
        rejectUnauthorized: true,
      } : undefined,
    };
  }
}

const redisConfig = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');
const redis = new Redis(redisConfig);

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message || err);
});

redis.on('connect', () => {
  logger.info('Redis connection established');
});

redis.on('ready', () => {
  logger.info('Redis connection ready');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', (delay) => {
  logger.info(`Redis reconnecting in ${delay}ms`);
});

redis.on('end', () => {
  logger.error('Redis connection ended');
});

export default redis;
