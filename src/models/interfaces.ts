export interface Rider {
  id: string | number;
  lastUpdatedAt: Date | string | number;
  lat: number;
  lng: number;
  rating: number;
  distanceToRestaurant?: number;
}

export interface Order {
  restaurantLat: number;
  restaurantLng: number;
}

export type AssignmentStatus = "SUCCESS" | "EXPANDED_MATCH" | "RETRY_QUEUE";

export interface AssignmentResult {
  status: AssignmentStatus;
  rider?: Rider;
  searchRadiusMeter?: number;
  message?: string;
  retryAfterSeconds?: number;
}

export interface CancellationLog {
  log_id: string; // UUID
  rider_id: string;
  order_id: string;
  cancellation_timestamp: Date;
  reason_code: number;
  reason_detail?: string;
  order_value: number;
  pickup_location_lat: number;
  pickup_location_lon: number;
  rider_current_location_lat: number;
  rider_current_location_lon: number;
  time_to_cancellation_minutes: number;
  distance_to_pickup_km: number;
  is_rush_hour: boolean;
  fraud_potential_score?: number;
  fraud_detection_flag?: boolean;
}
