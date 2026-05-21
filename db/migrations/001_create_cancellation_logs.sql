CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS cancellation_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL,
    order_id UUID NOT NULL,
    cancellation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason_code INT NOT NULL,
    reason_detail TEXT,
    order_value DECIMAL(12, 2),
    pickup_location_lat DECIMAL(9, 6),
    pickup_location_lon DECIMAL(9, 6),
    rider_current_location_lat DECIMAL(9, 6),
    rider_current_location_lon DECIMAL(9, 6),
    time_to_cancellation_minutes INT,
    distance_to_pickup_km DECIMAL(10, 2),
    is_rush_hour BOOLEAN,
    fraud_potential_score DECIMAL(5, 2),
    fraud_detection_flag BOOLEAN DEFAULT FALSE
);
