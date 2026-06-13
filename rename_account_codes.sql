-- ============================================================
-- AByte POS - Account Code Rename Script
-- Converts letter-based codes (A01, L01...) to numeric hierarchy
-- Format: Level2=10000-01, Level3=10000-01-001, Level4=10000-01-001-001
-- Run: SOURCE D:/AByte-POS/rename_account_codes.sql
-- ============================================================

-- IMPORTANT: Pehle test account "10000-01" delete karo agar banaya hai
-- DELETE FROM accounts WHERE account_code = '10000-01' AND level = 2 AND is_system = 0;

SET foreign_key_checks = 0;

START TRANSACTION;

-- ============================================================
-- STEP 1: Level 2 accounts rename (hardcoded IDs from DB)
-- ============================================================
UPDATE accounts SET account_code = '10000-01' WHERE account_id = 17; -- A01 Current Assets
UPDATE accounts SET account_code = '10000-02' WHERE account_id = 18; -- A02 Fixed Assets
UPDATE accounts SET account_code = '10000-03' WHERE account_id = 19; -- A03 Intangible Assets
UPDATE accounts SET account_code = '20000-01' WHERE account_id = 20; -- L01 Current Liabilities
UPDATE accounts SET account_code = '20000-02' WHERE account_id = 21; -- L02 Long-term Liabilities
UPDATE accounts SET account_code = '30000-01' WHERE account_id = 22; -- E01 Owner Equity
UPDATE accounts SET account_code = '30000-02' WHERE account_id = 23; -- E02 Retained Earnings
UPDATE accounts SET account_code = '40000-01' WHERE account_id = 26; -- X01 Cost of Goods Sold
UPDATE accounts SET account_code = '40000-02' WHERE account_id = 27; -- X02 Operating Expenses
UPDATE accounts SET account_code = '40000-03' WHERE account_id = 28; -- X03 Non-operating Expenses
UPDATE accounts SET account_code = '50000-01' WHERE account_id = 24; -- R01 Operating Revenue
UPDATE accounts SET account_code = '50000-02' WHERE account_id = 25; -- R02 Non-operating Revenue

-- ============================================================
-- STEP 2: Level 3 accounts rename (dynamic based on new L2 codes)
-- New format: parent_new_code + '-' + 3-digit-sequence
-- ============================================================
CREATE TEMPORARY TABLE l3_map AS
SELECT
  a.account_id,
  CONCAT(p.account_code, '-', LPAD(
    (SELECT COUNT(*) FROM accounts x
     WHERE x.parent_account_id = a.parent_account_id
       AND x.account_code <= a.account_code),
    3, '0')) AS new_code
FROM accounts a
JOIN accounts p ON a.parent_account_id = p.account_id
WHERE a.level = 3;

UPDATE accounts a
JOIN l3_map m ON a.account_id = m.account_id
SET a.account_code = m.new_code;

DROP TEMPORARY TABLE l3_map;

-- ============================================================
-- STEP 3: Level 4 accounts rename (dynamic based on new L3 codes)
-- New format: parent_new_code + '-' + 3-digit-sequence
-- ============================================================
CREATE TEMPORARY TABLE l4_map AS
SELECT
  a.account_id,
  CONCAT(p.account_code, '-', LPAD(
    (SELECT COUNT(*) FROM accounts x
     WHERE x.parent_account_id = a.parent_account_id
       AND x.account_code <= a.account_code),
    3, '0')) AS new_code
FROM accounts a
JOIN accounts p ON a.parent_account_id = p.account_id
WHERE a.level = 4;

UPDATE accounts a
JOIN l4_map m ON a.account_id = m.account_id
SET a.account_code = m.new_code;

DROP TEMPORARY TABLE l4_map;

COMMIT;

SET foreign_key_checks = 1;

-- ============================================================
-- VERIFY: Check result
-- ============================================================
SELECT level, COUNT(*) as total FROM accounts GROUP BY level ORDER BY level;

SELECT a.account_code, a.account_name, p.account_code as parent_code
FROM accounts a
LEFT JOIN accounts p ON a.parent_account_id = p.account_id
WHERE a.level <= 3
ORDER BY a.account_code;
