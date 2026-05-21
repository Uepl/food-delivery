import { Pool } from 'pg';
import { getTop3RestaurantsByAOV } from './restaurant.repository';

// Mock Pool
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
} as unknown as Pool;

describe("restaurant.repository.ts", () => {
  it("should execute the correct SQL query", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { category: 'Fast Food', restaurant_name: 'Burger King', aov: 150 },
        { category: 'Fast Food', restaurant_name: 'KFC', aov: 120 },
        { category: 'Fast Food', restaurant_name: 'McDonalds', aov: 100 },
      ],
    });

    const result = await getTop3RestaurantsByAOV(mockPool);

    expect(mockQuery).toHaveBeenCalled();
    const query = mockQuery.mock.calls[0][0];
    expect(query).toContain('WITH RestaurantStats AS');
    expect(query).toContain('DENSE_RANK() OVER (PARTITION BY category ORDER BY aov DESC)');
    expect(result.length).toBe(3);
    expect(result[0].restaurant_name).toBe('Burger King');
  });
});
