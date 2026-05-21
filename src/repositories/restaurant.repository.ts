import { Pool } from 'pg';

export const getTop3RestaurantsByAOV = async (pool: Pool) => {
  const query = `
WITH RestaurantStats AS (
    SELECT
        r.category,
        r.name AS restaurant_name,
        COALESCE(AVG(o.order_amount), 0) AS aov
    FROM restaurants r
    LEFT JOIN orders o ON r.id = o.restaurant_id
        AND o.status = 'delivered'
        AND o.order_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND o.order_date < DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')
    GROUP BY r.category, r.name
),
RankedRestaurants AS (
    SELECT
        category,
        restaurant_name,
        aov,
        DENSE_RANK() OVER (PARTITION BY category ORDER BY aov DESC) as rank
    FROM RestaurantStats
)
SELECT
    category,
    restaurant_name,
    aov
FROM RankedRestaurants
WHERE rank <= 3
ORDER BY category, rank;
  `;
  
  const result = await pool.query(query);
  return result.rows;
};
