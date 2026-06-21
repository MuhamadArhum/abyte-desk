// =============================================================
// migrationService.js - Numbered Database Migration Runner
// Replaces scattered ALTER TABLE calls in controllers.
// Each migration runs once per tenant DB, tracked in schema_migrations table.
// =============================================================

const { queryDb } = require('../config/database');
const logger = require('../config/logger');

// All migrations in order — add new ones at the bottom
const MIGRATIONS = [
  {
    version: 1,
    name: 'consolidate_schema_drift',
    async run(db) {
      const stmts = [
        // Sales
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS table_id INT NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) NULL DEFAULT 'on_spot'`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS token_no VARCHAR(20) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(20) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS bundle_discount DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS bundle_count INT DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS sub_total DECIMAL(10,2) DEFAULT 0.00`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_synced TINYINT(1) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_at DATETIME NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS profit DECIMAL(10,2) DEFAULT 0.00`,
        // Products
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2) DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL`,
        // Categories
        `ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Users
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Staff
        `ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE staff ADD COLUMN IF NOT EXISTS department_id INT NULL`,
        `ALTER TABLE staff ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(10,2) DEFAULT NULL`,
        `ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_status ENUM('active','inactive','terminated') DEFAULT 'active'`,
        // Customers
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) DEFAULT 0.00`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0.00`,
        `ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL`,
        // Credit Sales
        `ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT NULL`,
        // Other tables
        `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE stock_issues ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE stock_issue_returns ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE raw_sales ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE returns ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Purchase Vouchers
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS purchase_account_id INT DEFAULT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS payable_account_id INT DEFAULT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS journal_entry_id INT DEFAULT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS extra_charges DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS other_charges DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        `ALTER TABLE inv_purchase_vouchers ADD COLUMN IF NOT EXISTS supplier_id INT DEFAULT NULL`,
        // Store Settings
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_cash DECIMAL(5,2) DEFAULT 16`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_card DECIMAL(5,2) DEFAULT 5`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_on_online DECIMAL(5,2) DEFAULT 5`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS jv_delete_password VARCHAR(255) NULL`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_mode VARCHAR(10) DEFAULT 'simple'`,
        `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pos_tax_config TEXT NULL`,
        // Printers
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS printer_type ENUM('invoice','kot') NOT NULL DEFAULT 'invoice'`,
        `ALTER TABLE printers ADD COLUMN IF NOT EXISTS branch_id INT NULL`,
        // Stores
        `ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_charge DECIMAL(10,2) DEFAULT 0.00`,
        // Sale details
        `ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS profit DECIMAL(10,2) DEFAULT NULL`,
      ];
      for (const sql of stmts) {
        try { await queryDb(db, sql); } catch (e) {
          // Column already exists — non-fatal
          if (!e.message.includes('Duplicate column')) throw e;
        }
      }
    },
  },
  {
    version: 2,
    name: 'add_missing_indexes',
    async run(db) {
      const indexes = [
        [`ALTER TABLE sale_details ADD INDEX IF NOT EXISTS idx_sd_sale_id (sale_id)`],
        [`ALTER TABLE sale_details ADD INDEX IF NOT EXISTS idx_sd_product_id (product_id)`],
        [`ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_username (username)`],
        [`ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_active (is_active)`],
        [`ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_branch (branch_id)`],
        [`ALTER TABLE customers ADD INDEX IF NOT EXISTS idx_customer_deleted (deleted_at)`],
        [`ALTER TABLE products ADD INDEX IF NOT EXISTS idx_product_active (is_active)`],
        [`ALTER TABLE products ADD INDEX IF NOT EXISTS idx_product_deleted (deleted_at)`],
        [`ALTER TABLE credit_sales ADD INDEX IF NOT EXISTS idx_credit_due_date (due_date)`],
        [`ALTER TABLE audit_logs ADD INDEX IF NOT EXISTS idx_audit_user_date (user_id, created_at)`],
      ];
      for (const [sql] of indexes) {
        try { await queryDb(db, sql); }
        catch (e) {
          if (!e.message.includes('Duplicate key name')) throw e;
        }
      }
    },
  },
  {
    version: 3,
    name: 'token_blacklist_table',
    async run(db) {
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS token_blacklist (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          token_hash  VARCHAR(64)  NOT NULL UNIQUE,
          expires_at  DATETIME     NOT NULL,
          created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_expires (expires_at),
          INDEX idx_hash    (token_hash)
        )
      `);
    },
  },
  {
    version: 4,
    name: 'departments_table',
    async run(db) {
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS departments (
          department_id INT PRIMARY KEY AUTO_INCREMENT,
          department_name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    version: 5,
    name: 'customers_address_column',
    async run(db) {
      await queryDb(db, `ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT NULL`);
    },
  },
  {
    version: 6,
    name: 'waiter_role',
    async run(db) {
      // Add Waiter role and its default permissions
      await queryDb(db, `INSERT IGNORE INTO roles (role_name) VALUES ('Waiter')`);
      const perms = ['sales', 'sales.pos', 'customers'];
      for (const key of perms) {
        await queryDb(db,
          `INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES ('Waiter', ?, 1)`,
          [key]
        );
      }
    },
  },
  {
    version: 7,
    name: 'waiter_crud_permissions',
    async run(db) {
      // Waiter needs CRUD sub-keys because requirePermission('sales.pos') checks
      // 'sales.pos.create' for POST and 'sales.pos.update' for PUT
      const perms = [
        'sales.pos.create',
        'sales.pos.update',
        'customers.create',
      ];
      for (const key of perms) {
        await queryDb(db,
          `INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES ('Waiter', ?, 1)`,
          [key]
        );
      }
    },
  },
  {
    version: 8,
    name: 'ensure_joined_tables',
    async run(db) {
      // These tables are JOIN-ed in sales queries but only created lazily in controllers.
      // Missing tables cause 500 errors on every sales GET request.
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS restaurant_tables (
          table_id   INT PRIMARY KEY AUTO_INCREMENT,
          table_name VARCHAR(50)  NOT NULL,
          floor      VARCHAR(50)  DEFAULT 'Main',
          capacity   INT          DEFAULT 4,
          status     ENUM('available','occupied') DEFAULT 'available',
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS deliveries (
          delivery_id       INT PRIMARY KEY AUTO_INCREMENT,
          delivery_number   VARCHAR(30)  NULL,
          sale_id           INT          NULL,
          customer_id       INT          NULL,
          delivery_address  TEXT         NULL,
          delivery_city     VARCHAR(100) DEFAULT '',
          delivery_phone    VARCHAR(30)  DEFAULT '',
          rider_name        VARCHAR(100) DEFAULT '',
          rider_phone       VARCHAR(30)  DEFAULT '',
          status            VARCHAR(30)  DEFAULT 'pending',
          delivery_charges  DECIMAL(10,2) DEFAULT 0,
          estimated_delivery DATETIME   NULL,
          notes             TEXT         NULL,
          created_by        INT          NULL,
          branch_id         INT          NULL,
          created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    version: 9,
    name: 'sales_missing_columns',
    async run(db) {
      const stmts = [
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_percent DECIMAL(5,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_amount DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30) NULL`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0`,
      ];
      for (const sql of stmts) {
        try { await queryDb(db, sql); } catch (e) {
          if (!e.message.includes('Duplicate column')) throw e;
        }
      }
    },
  },
  {
    version: 10,
    name: 'printer_agent_url',
    async run(db) {
      await queryDb(db, `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS printer_agent_url VARCHAR(255) NULL`);
    },
  },
  {
    version: 11,
    name: 'print_queue_table',
    async run(db) {
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS print_queue (
          id           INT AUTO_INCREMENT PRIMARY KEY,
          type         VARCHAR(50)  NOT NULL DEFAULT 'invoice',
          payload      JSON         NOT NULL,
          status       ENUM('pending','printing','done','failed') DEFAULT 'pending',
          error_message TEXT        NULL,
          created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME     NULL,
          INDEX idx_pq_status (status),
          INDEX idx_pq_created (created_at)
        )
      `);
    },
  },
  {
    version: 12,
    name: 'agent_token_column',
    async run(db) {
      await queryDb(db, `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS agent_token VARCHAR(100) NULL`);
    },
  },
  {
    version: 13,
    name: 'biometric_attendance_tables',
    async run(db) {
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS biometric_devices (
          device_id     INT PRIMARY KEY AUTO_INCREMENT,
          device_name   VARCHAR(100) NOT NULL,
          ip_address    VARCHAR(45)  NOT NULL,
          port          INT          DEFAULT 80,
          serial_number VARCHAR(100) NULL,
          model         VARCHAR(100) NULL,
          last_sync     DATETIME     NULL,
          is_active     TINYINT(1)   DEFAULT 1,
          created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS biometric_logs (
          log_id        INT PRIMARY KEY AUTO_INCREMENT,
          device_id     INT          NULL,
          employee_code VARCHAR(50)  NOT NULL,
          punch_time    DATETIME     NOT NULL,
          punch_type    ENUM('in','out','auto') DEFAULT 'auto',
          raw_data      TEXT         NULL,
          processed     TINYINT(1)   DEFAULT 0,
          attendance_id INT          NULL,
          created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_bio_employee (employee_code),
          INDEX idx_bio_punch (punch_time),
          INDEX idx_bio_processed (processed),
          UNIQUE KEY unique_punch (employee_code, punch_time)
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS biometric_staff_mapping (
          mapping_id    INT PRIMARY KEY AUTO_INCREMENT,
          employee_code VARCHAR(50)  NOT NULL UNIQUE,
          staff_id      INT          NOT NULL,
          created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    version: 14,
    name: 'store_inventory_table',
    async run(db) {
      // B-010: store_inventory used in stockTransferController but never created in migrations
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS store_inventory (
          id              INT PRIMARY KEY AUTO_INCREMENT,
          store_id        INT NOT NULL,
          product_id      INT NOT NULL,
          available_stock DECIMAL(10,2) DEFAULT 0,
          updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_store_product (store_id, product_id),
          INDEX idx_si_store (store_id),
          INDEX idx_si_product (product_id)
        )
      `);
    },
  },
  {
    version: 15,
    name: 'ensure_runtime_created_tables',
    async run(db) {
      // B-023: Tables created at runtime in controllers — add to migrations for fresh installs
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS sale_bundles (
          id              INT PRIMARY KEY AUTO_INCREMENT,
          sale_id         INT NOT NULL,
          bundle_id       INT NOT NULL,
          bundle_name     VARCHAR(200) NOT NULL,
          discount_amount DECIMAL(10,2) DEFAULT 0,
          created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sb_sale (sale_id)
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS stock_layers (
          layer_id      INT PRIMARY KEY AUTO_INCREMENT,
          product_id    INT NOT NULL,
          pv_id         INT NULL,
          source_type   VARCHAR(50) NOT NULL DEFAULT 'purchase',
          ref_date      DATE NULL,
          qty_original  DECIMAL(10,2) NOT NULL DEFAULT 0,
          qty_remaining DECIMAL(10,2) NOT NULL DEFAULT 0,
          unit_cost     DECIMAL(10,4) NOT NULL DEFAULT 0,
          created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sl_product (product_id),
          INDEX idx_sl_pv (pv_id)
        )
      `);
      await queryDb(db, `
        CREATE TABLE IF NOT EXISTS opening_stock_entries (
          entry_id    INT PRIMARY KEY AUTO_INCREMENT,
          product_id  INT NOT NULL,
          quantity    DECIMAL(10,2) NOT NULL,
          unit_cost   DECIMAL(10,4) DEFAULT 0,
          entry_date  DATE NOT NULL,
          notes       TEXT NULL,
          created_by  INT NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ose_product (product_id)
        )
      `);
    },
  },
];

async function ensureMigrationsTable(db) {
  await queryDb(db, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INT PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedVersions(db) {
  const rows = await queryDb(db, 'SELECT version FROM schema_migrations ORDER BY version');
  return new Set(rows.map(r => r.version));
}

async function runMigrationsForDb(db) {
  try {
    await ensureMigrationsTable(db);
    const applied = await getAppliedVersions(db);

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;

      try {
        await migration.run(db);
        await queryDb(db, 'INSERT IGNORE INTO schema_migrations (version, name) VALUES (?, ?)', [
          migration.version, migration.name,
        ]);
        logger.info(`[Migration] v${migration.version} "${migration.name}" applied`, { db });
      } catch (err) {
        logger.error(`[Migration] v${migration.version} FAILED on ${db}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.warn(`[Migration] Could not run migrations on ${db}`, { error: err.message });
  }
}

module.exports = { runMigrationsForDb };
