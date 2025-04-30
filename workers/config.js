const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// Constants
const MAX_RETRIES = 2;
const PROCESSING_QUEUE = 'dm:processing:queue';
const QUEUE_PREFIX = 'queue:';
const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';

module.exports = {
  prisma,
  redis,
  MAX_RETRIES,
  PROCESSING_QUEUE,
  QUEUE_PREFIX,
  WORKER_HEARTBEAT_KEY
}; 