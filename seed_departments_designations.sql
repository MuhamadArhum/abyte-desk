-- ============================================================
-- AByte POS - Departments & Designations Seed
-- ============================================================

SET foreign_key_checks = 0;

-- ============================================================
-- STEP 1: Insert Departments
-- ============================================================
INSERT INTO departments (department_name) VALUES
('ADMIN STAFF'),
('FRONT STAFF (FC)'),
('FRONT STAFF (HALL)'),
('FRONT STAFF (QILA)'),
('GENERAL STAFF'),
('KITCHEN STAFF');

-- ============================================================
-- STEP 2: Insert Designations
-- (department_id NULL = cross-department designation)
-- ============================================================

-- Get department IDs into variables
SET @admin   = (SELECT department_id FROM departments WHERE department_name = 'ADMIN STAFF');
SET @fc      = (SELECT department_id FROM departments WHERE department_name = 'FRONT STAFF (FC)');
SET @hall    = (SELECT department_id FROM departments WHERE department_name = 'FRONT STAFF (HALL)');
SET @qila    = (SELECT department_id FROM departments WHERE department_name = 'FRONT STAFF (QILA)');
SET @general = (SELECT department_id FROM departments WHERE department_name = 'GENERAL STAFF');
SET @kitchen = (SELECT department_id FROM departments WHERE department_name = 'KITCHEN STAFF');

INSERT INTO designations (name, department_id) VALUES
-- Admin
('Accountant',          @admin),
-- Front Staff (cross-department)
('Captain',             NULL),
('Cash Officer',        NULL),
('Food XPR',            NULL),
('GRO',                 NULL),
('Waiter',              NULL),
('Manager',             NULL),
('Supervisor Hall',     NULL),
('Helper Waiter',       NULL),
('Helper Gol Gappy',    NULL),
('Bar Man',             @hall),
-- General Staff
('Car Parking',         @general),
('Delivery Man',        @general),
('Dish Washer Hall',    @general),
('Dish Washer Out',     @general),
('Electrician',         @general),
('House Man Hall',      @general),
('House Man Out',       @general),
('Mali',                @general),
('Purchaser',           @general),
('Security Guard',      @general),
('Store Incharge',      @general),
('Store Man',           @general),
('Helper Store Man',    @general),
('Carpenter',           @general),
-- Kitchen Staff
('Chinese Cook',        @kitchen),
('Chinese Helper',      @kitchen),
('Continental',         @kitchen),
('Helper B.B.Q',        @kitchen),
('Helper Chinese',      @kitchen),
('Helper Continental',  @kitchen),
('Helper Fast Food',    @kitchen),
('Helper Salad Man',    @kitchen),
('Helper Tandooria',    @kitchen),
('Salad Man',           @kitchen),
('Tandooria',           @kitchen),
('Chef Pakistani',      @kitchen),
('Helper Pakistani',    @kitchen);

-- ============================================================
-- STEP 3: Update staff.department_id
-- ============================================================
UPDATE staff s
JOIN departments d ON d.department_name = s.department
SET s.department_id = d.department_id;

SET foreign_key_checks = 1;

-- Verify
SELECT 'Departments:' as info;
SELECT department_id, department_name FROM departments ORDER BY department_id;

SELECT 'Designations:' as info;
SELECT designation_id, name, d.department_name FROM designations des
LEFT JOIN departments d ON des.department_id = d.department_id
ORDER BY des.designation_id;

SELECT 'Staff department_id update:' as info;
SELECT department, department_id, COUNT(*) as count
FROM staff
GROUP BY department, department_id
ORDER BY department;
