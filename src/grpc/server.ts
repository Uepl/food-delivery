import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import Redis from 'ioredis';
import { Producer } from 'kafkajs';
import path from 'path';
import { Pool } from 'pg';

const PROTO_PATH = path.resolve(__dirname, '../proto/tracking.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const trackingProto: any = grpc.loadPackageDefinition(packageDefinition).tracking;

// Interface for DI
export interface GrpcDependencies {
  pool: Pool;
  redis: Redis;
  redisPub: Redis;
  redisSub: Redis;
  producer: Producer;
}

export function startGrpcServer(deps: GrpcDependencies) {
  const { pool, redis, redisPub, redisSub, producer } = deps;

  let activeSubscriptions = 0;

  const trackingServerHandlers = {
    // 1. Rider Updates Location (Client Streaming)
    UpdateLocation: (call: any, callback: any) => {
      call.on('data', async (location: any) => {
        const { rider_id, latitude, longitude, timestamp } = location;
        const payload = JSON.stringify(location);

        // A. Hot Path: Save to Redis GEO for spatial queries
        await redis.geoadd('riders_location', longitude, latitude, rider_id);
        
        // B. Fan-out: Publish to Redis Pub/Sub for active customers
        await redisPub.publish(`rider:location:${rider_id}`, payload);

        // C. Cold Path: Send to Kafka for DB persistence
        await producer.send({
          topic: 'rider-location-updates',
          messages: [{ value: payload }],
        }).catch(err => console.error('Kafka send error:', err));
      });

      call.on('end', () => {
        callback(null, { success: true, message: 'Stream ended' });
      });
    },

    // 2. Customer Tracks Rider (Server Streaming)
    TrackRider: async (call: any) => {
      const { rider_id } = call.request;
      const channel = `rider:location:${rider_id}`;

      console.log(`Customer started tracking rider: ${rider_id}`);
      activeSubscriptions++;
      console.log(`[RedisSub] Subscribed to ${channel}. Active: ${activeSubscriptions}`);

      const messageHandler = (chan: string, message: string) => {
        if (chan === channel) {
          call.write(JSON.parse(message));
        }
      };

      redisSub.subscribe(channel);
      redisSub.on('message', messageHandler);

      // Clean up when customer disconnects
      call.on('cancelled', () => {
        redisSub.unsubscribe(channel);
        redisSub.removeListener('message', messageHandler);
        activeSubscriptions--;
        console.log(`[RedisSub] Unsubscribed from ${channel}. Active: ${activeSubscriptions}`);
        console.log(`Customer stopped tracking rider: ${rider_id}`);
      });
    },

    // 3. Log Cancellation
    LogCancellation: async (call: any, callback: any) => {
      const { rider_id, order_id, reason_code, reason_detail, order_value, pickup_lat, pickup_lon, rider_lat, rider_lon, time_to_cancellation_minutes, distance_to_pickup_km, is_rush_hour } = call.request;

      try {
        await pool.query(
          `INSERT INTO cancellation_logs (rider_id, order_id, reason_code, reason_detail, order_value, pickup_location_lat, pickup_location_lon, rider_current_location_lat, rider_current_location_lon, time_to_cancellation_minutes, distance_to_pickup_km, is_rush_hour)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [rider_id, order_id, reason_code, reason_detail, order_value, pickup_lat, pickup_lon, rider_lat, rider_lon, time_to_cancellation_minutes, distance_to_pickup_km, is_rush_hour]
        );
        callback(null, { success: true, message: 'Cancellation logged successfully' });
      } catch (err) {
        console.error('Database error:', err);
        callback(err, { success: false, message: 'Failed to log cancellation' });
      }
    }
  };

  const server = new grpc.Server();
  server.addService(trackingProto.TrackingService.service, trackingServerHandlers);
  
  const port = '0.0.0.0:50051';
  server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error('Failed to bind gRPC server:', err);
      return;
    }
    server.start();
    console.log(`gRPC Tracking Server running at ${port}`);
  });
}

