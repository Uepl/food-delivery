import { Kafka } from 'kafkajs';
import Redis from 'ioredis';

const kafka = new Kafka({ 
    clientId: 'incentive-engine', 
    brokers: [process.env.KAFKA_BROKER || 'localhost:29092'] 
});
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

export async function startIncentiveEngine() {
  const consumer = kafka.consumer({ groupId: 'incentive-group' });
  await consumer.connect();
  // Subscribe to location updates
  await consumer.subscribe({ topic: 'rider-location-updates', fromBeginning: false });

  console.log('Incentive Engine started...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const location = JSON.parse(message.value.toString());
      
      // LOGIC: Simple density calculation
      // 1. Identify grid area for location.lat/lon
      // 2. Increment active rider count in Redis (using HINCRBY)
      // 3. If count > threshold, update bonus rate
      
      const gridKey = `grid:${Math.floor(location.latitude)}:${Math.floor(location.longitude)}`;
      await redis.hincrby('active_riders', gridKey, 1);
      
      // Set expiry to simulate active window
      await redis.expire('active_riders', 60); 

      // Update bonus if threshold met (e.g., > 10 riders in this grid)
      const riderCount = await redis.hget('active_riders', gridKey);
      if (Number(riderCount) > 10) {
        await redis.set(`bonus:${gridKey}`, '1.5'); // Bonus multiplier 1.5
      } else {
        await redis.set(`bonus:${gridKey}`, '1.0'); // Standard
      }
    },
  });
}
