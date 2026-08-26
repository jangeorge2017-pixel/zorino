-- Fix coupon trust defaults: new coupons should be unverified until manually confirmed
ALTER TABLE coupons ALTER COLUMN verified SET DEFAULT FALSE;

-- Remove fabricated used_times from seed data
UPDATE coupons SET used_times = 0 WHERE used_times > 0;
