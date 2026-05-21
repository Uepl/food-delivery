import express from 'express';
import { Pool } from 'pg';
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

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`Hello World! DB time: ${result.rows[0].now}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database connection error');
  }
});

// Start gRPC Tracking Server
startGrpcServer(pool);

// Start Incentive Engine
startIncentiveEngine().catch(console.error);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
