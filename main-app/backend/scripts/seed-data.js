// ============================================================
// seed-data.js — 100k records per core table for load testing
// Run: node scripts/seed-data.js
// ============================================================
const mariadb = require('mariadb');

const DB = {
  host:               'localhost',
  port:               3306,
  user:               'root',
  password:           '12345',
  database:           'abytedesk-arhum',
  multipleStatements: true,
  connectTimeout:     30000,
};

const BATCH = 5000; // rows per INSERT batch

// ── Helpers ──────────────────────────────────────────────────
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = arr => arr[rand(0, arr.length - 1)];
const money = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const date  = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysAgo));
  return d.toISOString().slice(0, 10);
};
const ts = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysAgo));
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

async function batchInsert(conn, table, cols, rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const ph = chunk.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
    await conn.query(`INSERT IGNORE INTO \`${table}\` (${cols.join(',')}) VALUES ${ph}`, chunk.flat());
    process.stdout.write(`  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

async function seed() {
  const conn = await mariadb.createConnection(DB);
  console.log('Connected. Seeding...\n');

  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query('SET UNIQUE_CHECKS=0');
  await conn.query('SET autocommit=0');

  // ── 1. CATEGORIES (500) ─────────────────────────────────────
  const catTypes  = ['finished_good', 'raw_material', 'semi_finished'];
  const catNames  = ['Electronics','Clothing','Food','Beverages','Stationery','Tools','Furniture','Medicines','Cosmetics','Sports',
                     'Bakery','Dairy','Meat','Vegetables','Fruits','Cleaning','Toys','Books','Jewellery','Footwear'];
  const cats = [];
  for (let i = 1; i <= 500; i++) {
    cats.push([`${pick(catNames)} ${i}`, pick(catTypes), 1]);
  }
  await batchInsert(conn, 'categories', ['category_name','category_type','is_active'], cats);

  // ── 2. SUPPLIERS (1,000) ─────────────────────────────────────
  const supNames = ['Ali Traders','Khan Supplies','Pak Distributors','City Wholesale','Metro Imports',
                    'Royal Goods','National Traders','Prime Suppliers','Excel Corp','Star Trading'];
  const sups = [];
  for (let i = 1; i <= 1000; i++) {
    sups.push([`${pick(supNames)} ${i}`, `Contact ${i}`, `03${rand(10,49)}${rand(1000000,9999999)}`,
               `supplier${i}@example.com`, `City ${rand(1,50)}`, 1]);
  }
  await batchInsert(conn, 'suppliers', ['supplier_name','contact_person','phone','email','address','is_active'], sups);

  // ── 3. CUSTOMERS (100,000) ───────────────────────────────────
  const firstNames = ['Ali','Ahmed','Muhammad','Hassan','Zain','Omar','Sara','Fatima','Aisha','Sana',
                      'Bilal','Usman','Hamza','Ayesha','Nadia','Imran','Asad','Fahad','Tariq','Kamran'];
  const lastNames  = ['Khan','Malik','Shah','Iqbal','Ahmed','Raza','Butt','Chaudhry','Siddiqui','Mirza'];
  const custs = [];
  for (let i = 2; i <= 100001; i++) {
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    custs.push([name, `03${String(i).padStart(9,'0')}`,
                `customer${i}@mail.com`, money(0, 50000), money(0, 100000)]);
  }
  await batchInsert(conn, 'customers', ['customer_name','phone_number','email','balance','credit_limit'], custs);

  // ── 4. PRODUCTS (10,000) ─────────────────────────────────────
  const prodNames = ['Rice','Sugar','Tea','Coffee','Milk','Bread','Butter','Cheese','Oil','Salt',
                     'Flour','Biscuits','Chips','Juice','Water','Shampoo','Soap','Detergent','Tissue','Pen'];
  const units = ['pcs','kg','g','ltr','ml','box','pack','dozen','set','pair'];
  const prods = [];
  for (let i = 1; i <= 10000; i++) {
    const cost  = money(10, 2000);
    const price = parseFloat((cost * money(1.1, 2.0)).toFixed(2));
    const catId = rand(1, 500);
    prods.push([`${pick(prodNames)} ${i}`, catId, 'finished_good', pick(units),
                price, price, cost, rand(0, 5000), rand(5, 50), rand(2, 20),
                `SKU-${String(i).padStart(6,'0')}`, `BAR${String(i).padStart(9,'0')}`, 1]);
  }
  await batchInsert(conn, 'products',
    ['product_name','category_id','product_type','unit','price','selling_price','cost_price',
     'stock_quantity','reorder_level','min_stock_level','sku','barcode','is_active'], prods);

  // ── 5. INVENTORY (10,000) ────────────────────────────────────
  const inv = [];
  for (let i = 1; i <= 10000; i++) {
    inv.push([i, rand(0, 5000), money(10, 2000)]);
  }
  await batchInsert(conn, 'inventory', ['product_id','available_stock','avg_cost'], inv);

  // ── 6. USERS (200) ──────────────────────────────────────────
  const roles    = [{ id:1, name:'Admin' }];
  const pwHash   = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // password
  const userRows = [];
  for (let i = 2; i <= 200; i++) {
    userRows.push([`user${i}`, `Staff ${i}`, `staff${i}@abyte.com`, pwHash, 1, 'Admin', 1]);
  }
  await batchInsert(conn, 'users', ['username','name','email','password_hash','role_id','role_name','is_active'], userRows);

  // ── 7. SALES (100,000) ───────────────────────────────────────
  const payMethods = ['cash','card','bank_transfer','credit','cheque'];
  const sales = [];
  for (let i = 1; i <= 100000; i++) {
    const sub  = money(500, 50000);
    const disc = money(0, sub * 0.1);
    const tax  = parseFloat((sub * 0.05).toFixed(2));
    const net  = parseFloat((sub - disc + tax).toFixed(2));
    const uid  = rand(1, 200);
    const cid  = rand(1, 100001);
    sales.push([sub, ts(730), sub, disc, 0, 0, net, uid, cid, tax, pick(payMethods), 'completed', 5.00, net]);
  }
  await batchInsert(conn, 'sales',
    ['sub_total','sale_date','total_amount','discount','bundle_discount','bundle_count',
     'net_amount','user_id','customer_id','tax_amount','payment_method','status','tax_percent','amount_paid'], sales);

  // ── 8. SALE DETAILS (200,000) ────────────────────────────────
  const saleDetails = [];
  for (let i = 1; i <= 200000; i++) {
    const saleId = rand(1, 100000);
    const prodId = rand(1, 10000);
    const qty    = rand(1, 10);
    const price  = money(100, 5000);
    const total  = parseFloat((qty * price).toFixed(2));
    saleDetails.push([saleId, prodId, qty, price, 0, total]);
  }
  await batchInsert(conn, 'sale_details',
    ['sale_id','product_id','quantity','unit_price','discount','total_price'], saleDetails);

  // ── 9. EXPENSES (100,000) ────────────────────────────────────
  const expTitles = ['Monthly Rent','Electricity Bill','Internet Bill','Staff Salary','Office Supplies',
                     'Fuel Expense','Maintenance Fee','Marketing Cost','Transport','Miscellaneous'];
  const expenses = [];
  for (let i = 1; i <= 100000; i++) {
    expenses.push([pick(expTitles), money(100, 100000), rand(1, 9), ts(730), `Expense note ${i}`, rand(1, 200)]);
  }
  await batchInsert(conn, 'expenses', ['title','amount','category_id','expense_date','description','user_id'], expenses);

  // ── 10. PURCHASE ORDERS (10,000) ─────────────────────────────
  const poStatuses = ['draft','pending','received','cancelled'];
  const pos = [];
  for (let i = 1; i <= 10000; i++) {
    pos.push([`PO-${String(i).padStart(6,'0')}`, rand(1, 1000), date(730),
              date(700), pick(poStatuses), money(1000, 500000), 0, rand(1, 200)]);
  }
  await batchInsert(conn, 'purchase_orders',
    ['po_number','supplier_id','order_date','expected_date','status','total_amount','additional_charges','created_by'], pos);

  // ── 11. PURCHASE ORDER ITEMS (50,000) ────────────────────────
  const poItems = [];
  for (let i = 1; i <= 50000; i++) {
    const qty  = rand(10, 500);
    const cost = money(50, 5000);
    poItems.push([rand(1, 10000), rand(1, 10000), qty, 0, cost, parseFloat((qty * cost).toFixed(2))]);
  }
  await batchInsert(conn, 'purchase_order_items',
    ['po_id','product_id','quantity_ordered','quantity_received','unit_cost','total_cost'], poItems);

  // ── 12. STAFF (500) ──────────────────────────────────────────
  const positions   = ['Cashier','Manager','Supervisor','Sales Staff','Delivery','Guard','Cleaner','Admin'];
  const departments = ['Sales','Operations','HR','Finance','IT','Logistics','Customer Service'];
  const staffRows   = [];
  for (let i = 1; i <= 500; i++) {
    staffRows.push([`EMP-${String(i).padStart(4,'0')}`, `Employee ${i}`,
                    `03${rand(10,49)}${String(rand(0,9999999)).padStart(7,'0')}`,
                    pick(positions), pick(departments), money(20000, 150000),
                    'monthly', date(3650), 1, rand(0, 30)]);
  }
  await batchInsert(conn, 'staff',
    ['employee_id','full_name','phone','position','department','salary','salary_type','hire_date','is_active','leave_balance'],
    staffRows);

  // ── 13. ATTENDANCE (100,000) ─────────────────────────────────
  const attStatuses = ['present','absent','half_day','leave','holiday'];
  const attSeen     = new Set();
  const att         = [];
  while (att.length < 100000) {
    const sid = rand(1, 500);
    const d   = date(365);
    const key = `${sid}_${d}`;
    if (attSeen.has(key)) continue;
    attSeen.add(key);
    att.push([sid, d, `0${rand(7,9)}:${rand(0,5)}${rand(0,9)}:00`,
              `1${rand(5,8)}:${rand(0,5)}${rand(0,9)}:00`, pick(attStatuses)]);
  }
  await batchInsert(conn, 'attendance',
    ['staff_id','attendance_date','check_in','check_out','status'], att);

  // ── 14. AUDIT LOGS (100,000) ─────────────────────────────────
  const actions   = ['login','logout','create_sale','update_product','delete_customer','create_user','update_settings'];
  const entities  = ['sale','product','customer','user','expense','purchase_order'];
  const auditRows = [];
  for (let i = 1; i <= 100000; i++) {
    const uid = rand(1, 200);
    auditRows.push([pick(actions), pick(entities), rand(1, 100000),
                    uid, `Staff ${uid}`, `Log entry ${i}`, '192.168.1.' + rand(1, 254), ts(730)]);
  }
  await batchInsert(conn, 'audit_logs',
    ['action','entity_type','entity_id','user_id','user_name','details','ip_address','created_at'], auditRows);

  // ── Commit ───────────────────────────────────────────────────
  await conn.query('COMMIT');
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  await conn.query('SET UNIQUE_CHECKS=1');
  await conn.query('SET autocommit=1');

  console.log('\n✅ Seeding complete!\n');
  console.log('  categories:          500');
  console.log('  suppliers:         1,000');
  console.log('  customers:       100,000');
  console.log('  products:         10,000');
  console.log('  inventory:        10,000');
  console.log('  users:               200');
  console.log('  sales:           100,000');
  console.log('  sale_details:    200,000');
  console.log('  expenses:        100,000');
  console.log('  purchase_orders:  10,000');
  console.log('  po_items:         50,000');
  console.log('  staff:               500');
  console.log('  attendance:      100,000');
  console.log('  audit_logs:      100,000');

  await conn.end();
}

seed().catch(e => {
  console.error('\n❌ Seed failed:', e.message);
  process.exit(1);
});
