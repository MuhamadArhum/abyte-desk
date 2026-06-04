-- Migration: Add customer_name, customer_phone to sales; add note to sale_details
-- Run this against your existing database

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20) NULL;

ALTER TABLE sale_details
  ADD COLUMN IF NOT EXISTS note TEXT NULL;
