import { getHaversineDistance, assignRider } from "./rider.service";
import { Rider, Order } from "../models/interfaces";
import { MAX_DISTANCE_INITIAL } from "../models/constants";

describe("rider.service.ts", () => {
  describe("getHaversineDistance", () => {
    it("should calculate distance between two identical points as 0", () => {
      expect(getHaversineDistance(0, 0, 0, 0)).toBe(0);
    });

    it("should calculate a known distance (e.g., 1 degree latitude difference is roughly 111km)", () => {
      // 1 degree lat diff at equator = approx 111,139 meters
      const distance = getHaversineDistance(0, 0, 1, 0);
      expect(distance).toBeGreaterThan(111000);
      expect(distance).toBeLessThan(112000);
    });
  });

  describe("assignRider", () => {
    const restaurantLat = 13.7563;
    const restaurantLng = 100.5018;
    const order: Order = { restaurantLat, restaurantLng };

    it("should assign the closest rider within initial distance", () => {
      const now = Date.now();
      const rider1: Rider = {
        id: 1,
        lastUpdatedAt: now - 1000,
        lat: 13.7570, // very close
        lng: 100.5020,
        rating: 4.5
      };
      const rider2: Rider = {
        id: 2,
        lastUpdatedAt: now - 1000,
        lat: 13.8000, // farther
        lng: 100.6000,
        rating: 5.0
      };

      const result = assignRider(order, [rider1, rider2], now);

      expect(result.status).toBe("SUCCESS");
      expect(result.rider?.id).toBe(1);
    });

    it("should use rating as tie-breaker for riders within threshold", () => {
      const now = Date.now();
      // Riders very close to each other
      const rider1: Rider = {
        id: 1,
        lastUpdatedAt: now - 1000,
        lat: 13.7564,
        lng: 100.5019,
        rating: 4.0
      };
      const rider2: Rider = {
        id: 2,
        lastUpdatedAt: now - 1000,
        lat: 13.7565,
        lng: 100.5020,
        rating: 5.0
      };

      const result = assignRider(order, [rider1, rider2], now);

      expect(result.status).toBe("SUCCESS");
      expect(result.rider?.id).toBe(2);
    });
  });
});
