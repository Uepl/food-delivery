import { Kafka, Consumer } from 'kafkajs';
import Redis from 'ioredis';
import pino from 'pino';
import { CLEANUP_WINDOW_MS, ZSET_EXPIRY_SECONDS, BONUS_EXPIRY_SECONDS, RIDER_THRESHOLD } from '../models/constants';

const logger = pino();

const LUA_KEY_COUNT = 2;

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
else
    redis.call('expire', bonusKey, bonusExpiry)
end

return riderCount
`;

function getIncentiveKeys(latitude: number, longitude: number) {
    const gridKey = `grid:${Math.floor(latitude * 1000)}:${Math.floor(longitude * 1000)}`;
    return {
        zsetKey: `{${gridKey}}:active_riders`,
        bonusKey: `{${gridKey}}:bonus`
    };
}

/**
 * Starts the incentive engine consumer.
 * @param kafka - The Kafka instance.
 * @param redis - The Redis instance.
 * @returns The Kafka consumer instance.
 * NOTE: The caller is responsible for invoking stopIncentiveEngine to clean up resources.
 */
export async function startIncentiveEngine(kafka: Kafka, redis: Redis) {
    // Validate constants
    if ([CLEANUP_WINDOW_MS, ZSET_EXPIRY_SECONDS, BONUS_EXPIRY_SECONDS, RIDER_THRESHOLD].some(c => typeof c !== 'number')) {
        throw new Error('Invalid incentive engine constants');
    }

    // Load script once and store SHA
    const redisScript = redis.script as unknown as (command: 'load', script: string) => Promise<string>;
    let scriptSha: string = await redisScript('load', INCENTIVE_LUA_SCRIPT);

    const consumer = kafka.consumer({ groupId: 'incentive-group' });
    await consumer.connect();
    // Subscribe to location updates
    await consumer.subscribe({ topic: 'rider-location-updates', fromBeginning: false });

    logger.info('Incentive Engine started...');

    await consumer.run({
        eachMessage: async ({ message, topic, partition }) => {
            if (!message.value) return;
            
            let location;
            try {
                location = JSON.parse(message.value.toString());
                if (location.latitude === undefined || location.longitude === undefined || location.rider_id === undefined) {
                    throw new Error('Invalid location data');
                }
            } catch (error) {
                logger.error({ error, topic, partition }, 'Failed to parse or validate location data');
                return;
            }

            const { zsetKey, bonusKey } = getIncentiveKeys(location.latitude, location.longitude);
            const now = Date.now();

            // Atomic operation using Lua script
            const executeScript = async (retry: boolean = true) => {
                try {
                    return await redis.evalsha(
                        scriptSha,
                        LUA_KEY_COUNT,
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
                    if (retry && error.message.includes('NOSCRIPT')) {
                        scriptSha = await redisScript('load', INCENTIVE_LUA_SCRIPT);
                        return executeScript(false);
                    }
                    throw error;
                }
            };

            try {
                await executeScript();
            } catch (error) {
                logger.error({ error, topic, partition }, 'Error processing message');
            }
        },
    });
    return consumer;
}

/**
 * Stops the incentive engine consumer.
 * @param consumer - The Kafka consumer instance to stop.
 */
export async function stopIncentiveEngine(consumer: Consumer) {
    await consumer.disconnect();
}
