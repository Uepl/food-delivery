import { Rider, Order, AssignmentResult } from "../models/interfaces";
import { 
  TWO_MINUTES_IN_MS, 
  MAX_DISTANCE_INITIAL, 
  TIE_BREAKER_THRESHOLD, 
  EXPANDED_RADIUS_STEPS,
  RETRY_DELAY_SECONDS
} from "../models/constants";

/**
 * คำนวณระยะทางระหว่างสองพิกัดด้วยสูตร Haversine (หน่วย: เมตร)
 */
export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // รัศมีของโลก (เมตร)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

/**
 * Sorts riders by distance, using rating as a tie-breaker within threshold.
 */
function sortRiders(riders: Rider[]): Rider[] {
  return [...riders].sort((a, b) => {
    const distA = a.distanceToRestaurant ?? 0;
    const distB = b.distanceToRestaurant ?? 0;
    const distanceDiff = distA - distB;

    if (Math.abs(distanceDiff) <= TIE_BREAKER_THRESHOLD) {
      return b.rating - a.rating;
    }
    return distanceDiff;
  });
}

function handleNoRiderFallback(order: Order, activeRiders: Rider[]): AssignmentResult {
  for (const radius of EXPANDED_RADIUS_STEPS) {
    const ridersInRadius = activeRiders.filter(
      (r) => (r.distanceToRestaurant ?? 0) <= radius,
    );

    if (ridersInRadius.length > 0) {
      const sorted = sortRiders(ridersInRadius);
      return {
        status: "EXPANDED_MATCH",
        rider: sorted[0],
        searchRadiusMeter: radius,
      };
    }
  }

  return {
    status: "RETRY_QUEUE",
    message: "No active riders within extended range. Holding order for retry batch.",
    retryAfterSeconds: RETRY_DELAY_SECONDS,
  };
}

export function assignRider(order: Order, riders: Rider[], currentTime: number = Date.now()): AssignmentResult {
  const activeRiders: Rider[] = riders
    .filter(
      (rider) =>
        currentTime - new Date(rider.lastUpdatedAt).getTime() <= TWO_MINUTES_IN_MS,
    )
    .map((rider) => ({
      ...rider,
      distanceToRestaurant: getHaversineDistance(
        rider.lat,
        rider.lng,
        order.restaurantLat,
        order.restaurantLng,
      ),
    }));

  const eligibleRiders = activeRiders.filter(
    (r) => (r.distanceToRestaurant ?? 0) <= MAX_DISTANCE_INITIAL,
  );

  if (eligibleRiders.length === 0) {
    return handleNoRiderFallback(order, activeRiders);
  }

  const sorted = sortRiders(eligibleRiders);

  return {
    status: "SUCCESS",
    rider: sorted[0],
    searchRadiusMeter: MAX_DISTANCE_INITIAL,
  };
}
