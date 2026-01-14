import { Queue } from 'bullmq';
import redis from './redis.js';

export const smsQueue = new Queue('sms-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});
