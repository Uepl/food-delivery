import express from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { startGrpcServer } from './grpc/server';
import { startIncentiveEngine } from './services/incentiveEngine';

const app = express();
const port = 3000;

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

async function start() {
  const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });
  const redisPub = new Redis({ host: process.env.REDIS_HOST || 'localhost' });
  const redisSub = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

  const kafka = new Kafka({
    clientId: 'tracking-service',
    brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
  });
  const producer = kafka.producer();
  await producer.connect();

  // Start gRPC Tracking Server
  startGrpcServer({ pool, redis, redisPub, redisSub, producer });
}

start().catch(console.error);

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`Hello World! DB time: ${result.rows[0].now}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database connection error');
  }
});

// Start Incentive Engine
startIncentiveEngine().catch(console.error);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
