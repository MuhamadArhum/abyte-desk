// ============================================================
// scale-data.js — Scale tables to ~100M rows via SQL doubling
// Run: node scripts/scale-data.js
// Each iteration doubles the table. 10 iterations = ~100M from 100k.
// ============================================================
const mariadb = require('mariadb');

const DB = {
  host: 'localhost', port: 3306,
  user: 'root', password: '12345',
  database: 'abytedesk-arhum',
  connectTimeout: 60000,
};

const TARGET = 100_000_000;

async function count(conn, table) {
  const r = await conn.query(`SELECT COUNT(*) c FROM \`${table}\``);
  return Number(r[0].c);
}

function log(table, n, target) {
  process.stdout.write(`  ${table.padEnd(24)} ${n.toLocaleString().padStart(13)} / ${target.toLocaleString()}\r`);
}

// Double a table using INSERT INTO ... SELECT (no unique fields)
async function doubleSimple(conn, table, cols, extra = '') {
  const c = cols.join(',');
  await conn.query(`INSERT INTO \`${table}\` (${c}) SELECT ${c} FROM \`${table}\` ${extra}`, [], { timeout: 0 });
}

async function scaleSimple(conn, table, cols, target, extra = '') {
  let n = await count(conn, table);
  let iter = 0;
  while (n < target && iter < 30) {
    log(table, n, target);
    await doubleSimple(conn, table, cols, extra);
    await conn.query('COMMIT');
    n = await count(conn, table);
    iter++;
  }
  console.log(`  ✓ ${table.padEnd(24)} ${n.toLocaleString().padStart(13)}`);
}

// Double a table that has unique fields — uses MAX-based offset
async function scaleWithOffset(conn, table, pkCol, cols, uniqueFn, target) {
  let n = await count(conn, table);
  let iter = 0;
  while (n < target && iter < 30) {
    log(table, n, target);
    const offR = await conn.query(`SELECT MAX(\`${pkCol}\`) off FROM \`${table}\``);
    const off = Number(offR[0].off) || n;
    const selectCols = cols.map(c => uniqueFn(c, off)).join(',');
    const insertCols = cols.join(',');
    await conn.query(
      `INSERT INTO \`${table}\` (${insertCols}) SELECT ${selectCols} FROM \`${table}\``,
      [], { timeout: 0 }
    );
    await conn.query('COMMIT');
    n = await count(conn, table);
    iter++;
  }
  console.log(`  ✓ ${table.padEnd(24)} ${n.toLocaleString().padStart(13)}`);
}

async function scale() {
  const conn = await mariadb.createConnection(DB);
  console.log('Connected.\n');

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('SET UNIQUE_CHECKS     = 0');
  await conn.query('SET autocommit        = 0');
  await conn.query('SET SESSION net_read_timeout  = 3600');
  await conn.query('SET SESSION net_write_timeout = 3600');
  await conn.query('SET SESSION wait_timeout      = 3600');

  console.log('Scaling tables to 100,000,000 rows each...\n');

  // ── 1. CUSTOMERS — unique: phone_number ─────────────────────
  await scaleWithOffset(conn, 'customers', 'customer_id',
    ['customer_name','phone_number','email','balance','credit_limit'],
    (col, off) => {
      if (col === 'phone_number') return `CONCAT('0', LPAD(customer_id + ${off}, 11, '3'))`;
      if (col === 'email')        return `CONCAT('c', customer_id + ${off}, '@m.co')`;
      return col;
    }, TARGET);

  // ── 2. SALES — no unique constraints ────────────────────────
  await scaleSimple(conn, 'sales',
    ['sub_total','sale_date','total_amount','discount','bundle_discount','bundle_count',
     'net_amount','user_id','customer_id','tax_amount','payment_method','status',
     'tax_percent','amount_paid'], TARGET);

  // ── 3. SALE_DETAILS — no unique constraints ──────────────────
  await scaleSimple(conn, 'sale_details',
    ['sale_id','product_id','quantity','unit_price','discount','total_price'], TARGET * 2);

  // ── 4. EXPENSES — no unique constraints ─────────────────────
  await scaleSimple(conn, 'expenses',
    ['title','amount','category_id','expense_date','description','user_id'], TARGET);

  // ── 5. AUDIT_LOGS — no unique constraints ───────────────────
  await scaleSimple(conn, 'audit_logs',
    ['action','entity_type','entity_id','user_id','user_name','details','ip_address','created_at'], TARGET);

  // ── 6. PURCHASE_ORDER_ITEMS — no unique constraints ──────────
  await scaleSimple(conn, 'purchase_order_items',
    ['po_id','product_id','quantity_ordered','quantity_received','unit_cost','total_cost'], TARGET);

  // ── 7. PURCHASE_ORDERS — unique: po_number ──────────────────
  await scaleWithOffset(conn, 'purchase_orders', 'po_id',
    ['po_number','supplier_id','order_date','expected_date','status','total_amount','additional_charges','created_by'],
    (col, off) => {
      if (col === 'po_number') return `CONCAT('PO-', LPAD(po_id + ${off}, 9, '0'))`;
      return col;
    }, TARGET);

  // ── Finalize ─────────────────────────────────────────────────
  await conn.query('COMMIT');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.query('SET UNIQUE_CHECKS      = 1');
  await conn.query('SET autocommit         = 1');

  console.log('\n\n✅ Done!\n');
  const tables = ['customers','sales','sale_details','expenses','audit_logs','purchase_order_items','purchase_orders'];
  for (const t of tables) {
    const n = await count(conn, t);
    console.log(`  ${t.padEnd(26)} ${n.toLocaleString()}`);
  }

  await conn.end();
}

scale().catch(e => {
  console.error('\n❌ Failed:', e.message);
  process.exit(1);
});
