// ============================================================
// seed-all-tables.js — Auto-seeds all 92 tables with 5000 rows
// Run: node scripts/seed-all-tables.js
// ============================================================
const mariadb = require('mariadb');

const DB_NAME = 'abytedesk-arhum';
const DB = { host: 'localhost', port: 3306, user: 'root', password: '12345', database: DB_NAME, connectTimeout: 30000 };
const TARGET = 5000;
const BATCH  = 500;

// Tables to skip (system/config — no bulk data needed)
const SKIP = new Set([
  'schema_migrations','store_settings','roles','account_groups',
  'expense_categories','token_blacklist','print_queue',
]);

const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const money = (a, b) => +(Math.random() * (b - a) + a).toFixed(2);
const pick  = arr => arr[rand(0, arr.length - 1)];
const rStr  = (n = 8) => Math.random().toString(36).substr(2, n);
const dates = ['2024-01-15','2024-03-20','2024-06-10','2024-09-05','2025-01-20','2025-04-15','2025-07-01','2025-11-10','2026-01-05','2026-05-20'];
const times = ['08:00:00','09:00:00','10:00:00','14:00:00','17:00:00','18:30:00'];
const dts   = ['2024-06-01 09:00:00','2024-09-15 10:30:00','2025-01-10 08:00:00','2025-06-20 14:00:00','2026-01-05 11:00:00'];

async function getColumns(conn, table) {
  return conn.query(
    `SELECT COLUMN_NAME cn, DATA_TYPE dt, COLUMN_TYPE ct, IS_NULLABLE nl,
            COLUMN_KEY ck, EXTRA ex, CHARACTER_MAXIMUM_LENGTH ml
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
    [DB_NAME, table]
  );
}

async function getUniqueIndexCols(conn, table) {
  const rows = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND NON_UNIQUE=0 AND INDEX_NAME!='PRIMARY'`,
    [DB_NAME, table]
  );
  return new Set(rows.map(r => r.COLUMN_NAME));
}

async function getCount(conn, table) {
  const r = await conn.query(`SELECT COUNT(*) c FROM \`${table}\``);
  return Number(r[0].c);
}

function genValue(col, i, uniqueCols) {
  if (col.ex === 'auto_increment') return null; // skip PK
  const n    = col.cn.toLowerCase();
  const dt   = col.dt.toLowerCase();
  const ct   = col.ct.toLowerCase();
  const uniq = uniqueCols.has(col.cn);

  // ENUM — pick valid value
  if (dt === 'enum') {
    const m = ct.match(/enum\((.+)\)/);
    if (m) return pick(m[1].split(',').map(v => v.replace(/'/g,'')));
  }

  // Timestamps / defaults — let DB handle
  if (col.ex.includes('DEFAULT_GENERATED') || n === 'created_at' || n === 'updated_at' || n === 'last_updated') return null;

  // Unique columns — append index for uniqueness
  const uid = uniq ? `_${i}` : '';

  // Name-based smart generation
  if (n === 'email' || n.includes('_email'))     return `user${i}${uid}@test.com`;
  if (n === 'phone' || n.includes('phone') || n.includes('mobile')) return uniq ? `03${String(i).padStart(9,'0')}` : `03${rand(100,499)}${rand(1000000,9999999)}`;
  if (n === 'username')                           return `user_${i}`;
  if (n === 'password_hash')                      return '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
  if (n === 'employee_id')                        return `EMP-${String(i).padStart(5,'0')}`;
  if (n === 'sku')                                return `SKU-${String(i).padStart(7,'0')}`;
  if (n === 'barcode')                            return `BAR${String(i).padStart(10,'0')}`;
  if (n === 'account_code')                       return `ACC-${String(i).padStart(6,'0')}`;
  if (n === 'po_number')                          return `PO-${String(i).padStart(8,'0')}`;
  if (n === 'pv_number')                          return `PV-${String(i).padStart(8,'0')}`;
  if (n === 'pr_number')                          return `PR-${String(i).padStart(8,'0')}`;
  if (n === 'issue_number' || n === 'return_number') return `ISS-${String(i).padStart(7,'0')}`;
  if (n === 'entry_number')                       return `JE-${String(i).padStart(8,'0')}`;
  if (n === 'voucher_number')                     return `VCH-${String(i).padStart(7,'0')}`;
  if (n === 'quotation_number' || n === 'delivery_number') return `QT-${String(i).padStart(7,'0')}`;
  if (n === 'sale_number')                        return `SL-${String(i).padStart(8,'0')}`;

  if (n.endsWith('_name') || n === 'name' || n === 'full_name' || n === 'title') return `${rStr(5).toUpperCase()} ${i}`;
  if (n === 'description' || n === 'notes' || n === 'reason' || n === 'address') return `Sample ${n} ${i}`;
  if (n === 'token' || n === 'reset_token' || n === 'agent_token') return rStr(32);

  if (n.includes('amount') || n.includes('price') || n.includes('salary') || n.includes('balance') ||
      n.includes('cost')   || n.includes('total')  || n.includes('charge') || n.includes('debit')  ||
      n.includes('credit') || n.includes('payment'))  return money(100, 50000);

  if (n.includes('percent') || n.includes('rate') || n.includes('tax') || n.includes('discount')) return money(0, 30);
  if (n.includes('quantity') || n.includes('qty') || n.includes('count') || n.includes('stock'))  return rand(1, 1000);
  if (n.includes('is_') || n.includes('has_') || n.includes('allow') || n.includes('_active'))    return 1;
  if (n.includes('level') || n.includes('priority') || n.includes('capacity') || n.includes('port')) return rand(1, 100);

  // FK id columns — use random refs (FK checks disabled)
  if (n.endsWith('_id') && dt === 'int') return rand(1, 200);

  // Date/time types
  if (dt === 'date')                  return pick(dates);
  if (dt === 'datetime' || dt === 'timestamp') return pick(dts);
  if (dt === 'time')                  return pick(times);

  // Numeric types
  if (['int','bigint','smallint','mediumint','tinyint'].includes(dt)) return rand(0, 1000);
  if (['decimal','float','double'].includes(dt))                       return money(0, 10000);

  // String types
  if (['varchar','char'].includes(dt)) {
    const maxLen = Math.min(Number(col.ml) || 50, 40);
    const val = rStr(Math.min(maxLen, 10));
    return uniq ? `${val}${i}` : val;
  }
  if (['text','mediumtext','longtext'].includes(dt)) return `Sample data for ${col.cn} row ${i}`;
  if (dt === 'json')                                 return '{}';

  return col.nl === 'YES' ? null : `${rStr(6)}${i}`;
}

async function seedTable(conn, table) {
  const existing = await getCount(conn, table);
  const needed   = TARGET;

  const cols       = await getColumns(conn, table);
  const uniqueCols = await getUniqueIndexCols(conn, table);
  const insertCols = cols.filter(c => c.ex !== 'auto_increment');

  if (!insertCols.length) {
    console.log(`  - ${table.padEnd(34)} skipped (no insertable columns)`);
    return;
  }

  const colNames = insertCols.map(c => `\`${c.cn}\``).join(',');
  let inserted = 0;

  for (let batch = 0; batch < Math.ceil(needed / BATCH); batch++) {
    const rows = [];
    for (let j = 0; j < BATCH && inserted + j < needed; j++) {
      const rowIdx = existing + inserted + j + 1;
      const vals   = insertCols.map(c => genValue(c, rowIdx, uniqueCols));
      // Remove trailing nulls only if they are auto-timestamp cols (they'll use DEFAULT)
      rows.push(vals);
    }

    if (!rows.length) break;

    const ph = rows.map(r => `(${r.map(() => '?').join(',')})`).join(',');
    try {
      await conn.query(
        `INSERT IGNORE INTO \`${table}\` (${colNames}) VALUES ${ph}`,
        rows.flat().map(v => v === null ? null : v)
      );
    } catch (e) {
      // Log and continue — don't let one table crash everything
      console.log(`\n  ⚠ ${table}: ${e.message.slice(0, 80)}`);
      break;
    }
    inserted += rows.length;
  }

  const final = await getCount(conn, table);
  console.log(`  ✓ ${table.padEnd(34)} ${final.toLocaleString().padStart(8)} rows  (+${(final - existing).toLocaleString()})`);
}

async function main() {
  const conn = await mariadb.createConnection(DB);
  console.log('Connected.\n');

  const tables = await conn.query(
    `SELECT table_name t FROM information_schema.tables
     WHERE table_schema=? AND table_type='BASE TABLE' ORDER BY table_name`,
    [DB_NAME]
  );

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('SET UNIQUE_CHECKS      = 0');

  console.log(`Seeding ${tables.length} tables (target: ${TARGET.toLocaleString()} rows each)...\n`);

  for (const { t } of tables) {
    if (SKIP.has(t)) {
      console.log(`  - ${t.padEnd(34)} skipped`);
      continue;
    }
    await seedTable(conn, t);
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.query('SET UNIQUE_CHECKS      = 1');

  console.log('\n✅ All tables seeded!\n');
  await conn.end();
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
