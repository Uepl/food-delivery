import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.resolve(__dirname, './proto/tracking.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const trackingProto: any = grpc.loadPackageDefinition(packageDefinition).tracking;

const client = new trackingProto.TrackingService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 1. Simulate Rider (Streaming updates)
function simulateRider(riderId: string) {
  const stream = client.UpdateLocation((err: any, response: any) => {
    if (err) console.error('Error:', err);
    else console.log('UpdateResponse:', response);
  });

  setInterval(() => {
    stream.write({
      rider_id: riderId,
      latitude: 13.7563 + Math.random() * 0.01,
      longitude: 100.5018 + Math.random() * 0.01,
      timestamp: Date.now()
    });
  }, 2000);
}

// 2. Simulate Customer (Tracking a rider)
function simulateCustomer(riderId: string) {
  const stream = client.TrackRider({ rider_id: riderId });
  stream.on('data', (location: any) => {
    console.log(`Customer received location for ${riderId}:`, location);
  });
}

// Start simulation
const RIDER_ID = 'rider-123';
simulateCustomer(RIDER_ID);
setTimeout(() => simulateRider(RIDER_ID), 1000); // Give customer a sec to subscribe
