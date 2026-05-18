-- ============================================================
-- Migration 002: Optional Table Partitioning
-- WARNING: Read full instructions before running.
--
-- Requirements:
--   - MariaDB 10.0+ / MySQL 5.5+
--   - Tables must have NO foreign key constraints (MySQL limitation)
--   - Run during low-traffic maintenance window
--   - Take a full backup before running
--
-- Strategy:
--   - sales: RANGE partition by YEAR(sale_date) — old years archived
--   - audit_logs: RANGE partition by YEAR(created_at) — old logs archived
--
-- To check if partitioning is supported:
--   SELECT @@have_partitioning;
--
-- HOW TO RUN:
--   1. Backup: mysqldump -u root -p abyte_pos > backup_before_partition.sql
--   2. Remove FKs from sales and audit_logs (listed below)
--   3. Run this script
--   4. Re-add FKs if needed (optional — app works without them)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: Drop FKs from sales (required before partitioning)
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE sales DROP FOREIGN KEY sales_ibfk_1;  -- user_id
-- ALTER TABLE sales DROP FOREIGN KEY sales_ibfk_2;  -- customer_id
-- ALTER TABLE sales DROP FOREIGN KEY sales_ibfk_3;  -- branch_id

-- ────────────────────────────────────────────────────────────
-- STEP 2: Add partitioning to sales table
-- ────────────────────────────────────────────────────────────
-- NOTE: sale_date column must be in the partition key
-- This reorganizes existing data into yearly partitions.
/*
ALTER TABLE sales
PARTITION BY RANGE (YEAR(sale_date)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
*/

-- ────────────────────────────────────────────────────────────
-- STEP 3: Drop FKs from audit_logs
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE audit_logs DROP FOREIGN KEY audit_logs_ibfk_1;  -- user_id

-- ────────────────────────────────────────────────────────────
-- STEP 4: Add partitioning to audit_logs
-- ────────────────────────────────────────────────────────────
/*
ALTER TABLE audit_logs
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
*/

-- ────────────────────────────────────────────────────────────
-- STEP 5: Add new yearly partition (run each January)
-- ────────────────────────────────────────────────────────────
/*
ALTER TABLE sales
    REORGANIZE PARTITION p_future INTO (
        PARTITION p2027 VALUES LESS THAN (2028),
        PARTITION p_future VALUES LESS THAN MAXVALUE
    );

ALTER TABLE audit_logs
    REORGANIZE PARTITION p_future INTO (
        PARTITION p2027 VALUES LESS THAN (2028),
        PARTITION p_future VALUES LESS THAN MAXVALUE
    );
*/

-- ────────────────────────────────────────────────────────────
-- STEP 6: Archive old partition (drop data older than 2 years)
-- WARNING: This permanently deletes data. Ensure backup exists.
-- ────────────────────────────────────────────────────────────
/*
ALTER TABLE audit_logs DROP PARTITION p2023;
*/

-- ────────────────────────────────────────────────────────────
-- VERIFY: Check partition info
-- ────────────────────────────────────────────────────────────
/*
SELECT TABLE_NAME, PARTITION_NAME, TABLE_ROWS, AVG_ROW_LENGTH, DATA_LENGTH
FROM information_schema.PARTITIONS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('sales', 'audit_logs')
ORDER BY TABLE_NAME, PARTITION_NAME;
*/
