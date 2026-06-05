// =============================================================
// migrate-all.js — Run pending migrations on ALL tenant DBs
//
// Usage:
//   node scripts/migrate-all.js
//
// What it does:
//   1. Reads all active tenants from abyte_master.tenants
//   2. Runs any pending migrations on each tenant DB
//   3. Skips already-applied migrations (tracked in schema_migrations)
//   4. Reports success/failure for each tenant
// =============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { queryDb }            = require('../config/database');
const { runMigrationsForDb } = require('../services/migrationService');

const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';

// ANSI colors for terminal output
const c = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};

async function main() {
  console.log(`\n${c.bold}${c.cyan}══════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}  AByte POS — Run Migrations on All DBs${c.reset}`);
  console.log(`${c.cyan}══════════════════════════════════════${c.reset}\n`);

  // Step 1: Get all tenants from master DB
  let tenants;
  try {
    tenants = await queryDb(
      MASTER_DB,
      `SELECT tenant_id, tenant_code, tenant_name, db_name, is_active
       FROM tenants ORDER BY created_at ASC`
    );
  } catch (err) {
    console.error(`${c.red}✗ Could not read master DB (${MASTER_DB}): ${err.message}${c.reset}`);
    process.exit(1);
  }

  if (tenants.length === 0) {
    console.log(`${c.yellow}No tenants found in master DB.${c.reset}\n`);
    process.exit(0);
  }

  console.log(`${c.dim}Found ${tenants.length} tenant(s) — running migrations...\n${c.reset}`);

  let success = 0;
  let failed  = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const label = `${tenant.tenant_name} (${tenant.db_name})`;

    if (!tenant.is_active) {
      console.log(`${c.dim}  ⊘ SKIPPED  ${label} — inactive${c.reset}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${c.dim}Running ${label}...${c.reset}`);
    try {
      await runMigrationsForDb(tenant.db_name);
      process.stdout.write(`\r  ${c.green}✓ OK      ${c.reset}${label}\n`);
      success++;
    } catch (err) {
      process.stdout.write(`\r  ${c.red}✗ FAILED  ${c.reset}${label} — ${err.message}\n`);
      failed++;
    }
  }

  // Summary
  console.log(`\n${c.cyan}──────────────────────────────────────${c.reset}`);
  console.log(`  ${c.green}✓ Success : ${success}${c.reset}`);
  if (failed  > 0) console.log(`  ${c.red}✗ Failed  : ${failed}${c.reset}`);
  if (skipped > 0) console.log(`  ${c.dim}⊘ Skipped : ${skipped}${c.reset}`);
  console.log(`${c.cyan}──────────────────────────────────────${c.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\n${c.red}Unexpected error: ${err.message}${c.reset}\n`);
  process.exit(1);
});
