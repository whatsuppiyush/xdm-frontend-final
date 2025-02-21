import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Test the connection
redis.ping().then(() => {
  console.log('Successfully connected to Upstash Redis')
}).catch((error) => {
  console.error('Redis connection error:', error)
})

export default redis 