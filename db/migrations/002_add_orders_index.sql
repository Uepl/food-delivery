CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_date ON orders(restaurant_id, status, order_date) INCLUDE (order_amount);
