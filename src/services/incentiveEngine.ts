import { Kafka, Consumer } from 'kafkajs';
import Redis from 'ioredis';
import { CLEANUP_WINDOW_MS, ZSET_EXPIRY_SECONDS, BONUS_EXPIRY_SECONDS, RIDER_THRESHOLD } from '../models/constants';

const INCENTIVE_LUA_SCRIPT = `
local zsetKey = KEYS[1]
local bonusKey = KEYS[2]
local now = tonumber(ARGV[1])
local riderId = ARGV[2]
local cleanupWindow = tonumber(ARGV[3])
local zsetExpiry = tonumber(ARGV[4])
local bonusExpiry = tonumber(ARGV[5])
local threshold = tonumber(ARGV[6])

redis.call('zadd', zsetKey, now, riderId)
redis.call('zremrangebyscore', zsetKey, '-inf', now - cleanupWindow)
local riderCount = redis.call('zcard', zsetKey)
redis.call('expire', zsetKey, zsetExpiry)

local newBonus = riderCount > threshold and '1.5' or '1.0'
-- Only update if different
local currentBonus = redis.call('get', bonusKey)
if currentBonus ~= newBonus then
    redis.call('set', bonusKey, newBonus, 'EX', bonusExpiry)
end

return riderCount
`;

export async function startIncentiveEngine(kafka: Kafka, redis: Redis) {
  // Load script once and store SHA
  let scriptSha: string = await (redis.script as any)('load', INCENTIVE_LUA_SCRIPT);

  const consumer = kafka.consumer({ groupId: 'incentive-group' });
  await consumer.connect();
  // Subscribe to location updates
  await consumer.subscribe({ topic: 'rider-location-updates', fromBeginning: false });

  console.log('Incentive Engine started...');

  await consumer.run({
    eachMessage: async ({ message, topic, partition }) => {
      try {
        if (!message.value) return;
        const location = JSON.parse(message.value.toString());
        
        if (location.latitude === undefined || location.longitude === undefined || location.rider_id === undefined) {
          console.error('Invalid location data:', location);
          return;
        }

        // LOGIC: Simple density calculation
        // 1. Identify grid area for location.lat/lon (Higher resolution: approx 110m)
        const gridKey = `grid:${Math.floor(location.latitude * 1000)}:${Math.floor(location.longitude * 1000)}`;
        const now = Date.now();
        // Use hash tags to ensure keys are in the same slot
        const zsetKey = `{${gridKey}}:active_riders`;
        const bonusKey = `{${gridKey}}:bonus`;

        // Atomic operation using Lua script
        try {
            await redis.evalsha(
                scriptSha,
                2, 
                zsetKey, 
                bonusKey, 
                now, 
                location.rider_id, 
                CLEANUP_WINDOW_MS, 
                ZSET_EXPIRY_SECONDS, 
                BONUS_EXPIRY_SECONDS, 
                RIDER_THRESHOLD
            );
        } catch (error: any) {
            if (error.message.includes('NOSCRIPT')) {
                // NOSCRIPT: Script not loaded, reload and retry
                scriptSha = await (redis.script as any)('load', INCENTIVE_LUA_SCRIPT);
                await redis.evalsha(
                    scriptSha,
                    2,
                    zsetKey,
                    bonusKey,
                    now,
                    location.rider_id,
                    CLEANUP_WINDOW_MS,
                    ZSET_EXPIRY_SECONDS,
                    BONUS_EXPIRY_SECONDS,
                    RIDER_THRESHOLD
                );
            } else {
                throw error;
            }
        }
      } catch (error) {
        console.error(`Error processing message from topic ${topic} partition ${partition}:`, error);
        // Do not throw, allowing the consumer to continue
      }
    },
  });
  return consumer;
}

export async function stopIncentiveEngine(consumer: Consumer) {
  await consumer.disconnect();
}
