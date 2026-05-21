import { Kafka, Consumer } from 'kafkajs';
import Redis from 'ioredis';

export async function startIncentiveEngine(kafka: Kafka, redis: Redis) {
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
        
        // LOGIC: Simple density calculation
        // 1. Identify grid area for location.lat/lon (Higher resolution: approx 110m)
        const gridKey = `grid:${Math.floor(location.latitude * 1000)}:${Math.floor(location.longitude * 1000)}`;
        const now = Date.now();
        const zsetKey = `active_riders:${gridKey}`;
        const bonusKey = `bonus:${gridKey}`;

        // Use pipeline for atomic operations
        const pipeline = redis.pipeline();
        
        pipeline.zadd(zsetKey, now, location.rider_id);
        pipeline.zremrangebyscore(zsetKey, '-inf', now - 60000); // Clean up riders older than 1 minute
        pipeline.zcard(zsetKey);
        pipeline.expire(zsetKey, 300); // Ensure the ZSET key eventually expires if inactive
        
        const results = await pipeline.exec();
        
        // Results format: [[null, zadd_result], [null, zrem_result], [null, zcard_result], [null, expire_result]]
        if (!results) throw new Error('Pipeline execution failed');

        // Check for individual command errors
        for (const [error] of results) {
          if (error) throw error;
        }
        
        const riderCount = results[2][1] as number;
        
        // Update bonus based on count
        if (riderCount > 10) {
          await redis.set(bonusKey, '1.5', 'EX', 60); // Set bonus with short expiry
        } else {
          await redis.set(bonusKey, '1.0', 'EX', 60); // Set standard with short expiry
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
