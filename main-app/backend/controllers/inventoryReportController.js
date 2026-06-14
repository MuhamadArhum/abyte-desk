// =============================================================
// inventoryReportController.js - Inventory Reports Controller
// Generates stock summary, top products, category breakdown, slow movers,
// items ledger, item-wise purchase, and issuance summary reports.
// Used by: /api/inventory-reports routes
// =============================================================

const logger = require('../config/logger');
const { query } = require('../config/database');

function branchWhere(req, alias = 'p') {
  if (req.user.role_name !== 'Admin' && req.user.branch_id) {
    return { clause: ` AND ${alias}.branch_id = ?`, params: [req.user.branch_id] };
  }
  if (req.user.role_name === 'Admin' && req.query.filter_branch) {
    return { clause: ` AND ${alias}.branch_id = ?`, params: [req.query.filter_branch] };
  }
  return { clause: '', params: [] };
}

exports.getStockSummary = async (req, res) => {
  try {
    const branch = branchWhere(req, 'p');
    const [row] = await query(`
      SELECT
        COUNT(p.product_id) as total_products,
        COALESCE(SUM(i.available_stock), 0) as total_units,
        COALESCE(SUM(i.available_stock * COALESCE(p.cost_price, 0)), 0) as total_stock_value,
        COUNT(CASE WHEN COALESCE(i.available_stock, 0) = 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN COALESCE(i.available_stock, 0) > 0
                    AND COALESCE(i.available_stock, 0) <= COALESCE(p.min_stock_level, 10) THEN 1 END) as low_stock_count
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.is_active = 1${branch.clause}
    `, branch.params);
    res.json(row || {});
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10, date_from, date_to } = req.query;
    const branch = branchWhere(req, 's');
    let where = '1=1' + branch.clause;
    const params = [...branch.params];
    if (date_from) { where += ' AND s.sale_date >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND s.sale_date <= ?'; params.push(date_to); }
    params.push(parseInt(limit));
    const rows = await query(`
      SELECT p.product_id, p.product_name, c.category_name,
             SUM(sd.quantity) as units_sold,
             SUM(sd.total_price) as revenue
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      JOIN sales s ON sd.sale_id = s.sale_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE ${where}
      GROUP BY p.product_id, p.product_name, c.category_name
      ORDER BY units_sold DESC
      LIMIT ?
    `, params);
    res.json({ data: rows.map(r => ({ ...r, units_sold: Number(r.units_sold), revenue: Number(r.revenue) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const branch = branchWhere(req, 'p');
    const bClause = branch.clause ? `AND p.branch_id = ?` : '';
    const rows = await query(`
      SELECT c.category_id, c.category_name,
             COUNT(p.product_id) as product_count,
             COALESCE(SUM(i.available_stock), 0) as total_stock,
             COALESCE(SUM(i.available_stock * COALESCE(p.cost_price, 0)), 0) as stock_value
      FROM categories c
      LEFT JOIN products p ON c.category_id = p.category_id AND p.is_active = 1 ${bClause}
      LEFT JOIN inventory i ON p.product_id = i.product_id
      GROUP BY c.category_id, c.category_name
      ORDER BY stock_value DESC
    `, branch.params);
    res.json({ data: rows.map(r => ({ ...r, product_count: Number(r.product_count), total_stock: Number(r.total_stock), stock_value: Number(r.stock_value) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getSlowMovers = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const branch = branchWhere(req, 'p');
    const bClause = branch.clause ? `AND p.branch_id = ?` : '';
    const rows = await query(`
      SELECT
        p.product_id, p.product_name, c.category_name,
        COALESCE(i.available_stock, 0) as current_stock,
        MAX(s.sale_date) as last_sale_date,
        DATEDIFF(NOW(), MAX(s.sale_date)) as days_since_last_sale,
        COALESCE(i.available_stock, 0) * COALESCE(p.cost_price, 0) as value_at_risk
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN sale_details sd ON p.product_id = sd.product_id
      LEFT JOIN sales s ON sd.sale_id = s.sale_id
      WHERE p.is_active = 1 AND COALESCE(i.available_stock, 0) > 0 ${bClause}
      GROUP BY p.product_id, p.product_name, c.category_name, i.available_stock, p.cost_price
      HAVING last_sale_date IS NULL OR days_since_last_sale >= ?
      ORDER BY days_since_last_sale DESC, current_stock DESC
      LIMIT 50
    `, [...branch.params, parseInt(days)]);
    res.json({ data: rows.map(r => ({ ...r, current_stock: Number(r.current_stock), value_at_risk: Number(r.value_at_risk) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.itemsLedger = async (req, res) => {
  try {
    const { product_id, from_date, to_date } = req.query;
    if (!product_id) return res.status(400).json({ message: 'product_id is required' });
    const dw = (col) => {
      let w = '';
      if (from_date) w += ' AND ' + col + " >= '" + from_date + "'";
      if (to_date)   w += ' AND ' + col + " <= '" + to_date + "'";
      return w;
    };
    const purchases = await query(
      'SELECT pvi.pv_id as ref_id, pv.pv_number as ref_number, pv.voucher_date as txn_date,' +
      " 'Purchase' as txn_type, 'IN' as direction," +
      ' pvi.quantity_received as qty, pvi.unit_price,' +
      ' pvi.quantity_received * pvi.unit_price as amount,' +
      " COALESCE(s.supplier_name,'') as party, COALESCE(pv.notes,'') as notes" +
      ' FROM inv_purchase_voucher_items pvi' +
      ' JOIN inv_purchase_vouchers pv ON pvi.pv_id = pv.pv_id' +
      ' LEFT JOIN suppliers s ON pv.supplier_id = s.supplier_id' +
      ' WHERE pvi.product_id = ?' + dw('pv.voucher_date'), [product_id]);
    const purchaseReturns = await query(
      'SELECT pri.pr_id as ref_id, pr.pr_number as ref_number, pr.return_date as txn_date,' +
      " 'Purchase Return' as txn_type, 'OUT' as direction," +
      ' pri.quantity_returned as qty, pri.unit_price,' +
      ' pri.quantity_returned * pri.unit_price as amount,' +
      " COALESCE(s.supplier_name,'') as party, COALESCE(pr.notes,'') as notes" +
      ' FROM purchase_return_items pri' +
      ' JOIN purchase_returns pr ON pri.pr_id = pr.pr_id' +
      ' LEFT JOIN suppliers s ON pr.supplier_id = s.supplier_id' +
      ' WHERE pri.product_id = ?' + dw('pr.return_date'), [product_id]);
    const issues = await query(
      'SELECT sii.issue_id as ref_id, si.issue_number as ref_number, si.issue_date as txn_date,' +
      " 'Stock Issue' as txn_type, 'OUT' as direction," +
      ' sii.quantity as qty, sii.unit_cost as unit_price,' +
      ' sii.quantity * sii.unit_cost as amount,' +
      " sec.section_name as party, COALESCE(si.notes,'') as notes" +
      ' FROM stock_issue_items sii' +
      ' JOIN stock_issues si ON sii.issue_id = si.issue_id' +
      ' JOIN sections sec ON si.section_id = sec.section_id' +
      ' WHERE sii.product_id = ?' + dw('si.issue_date'), [product_id]);
    const stockReturns = await query(
      'SELECT sri.return_id as ref_id, sr.return_number as ref_number, sr.return_date as txn_date,' +
      " 'Stock Return' as txn_type, 'IN' as direction," +
      ' sri.quantity as qty, 0 as unit_price, 0 as amount,' +
      " sec.section_name as party, COALESCE(sr.notes,'') as notes" +
      ' FROM stock_issue_return_items sri' +
      ' JOIN stock_issue_returns sr ON sri.return_id = sr.return_id' +
      ' JOIN sections sec ON sr.section_id = sec.section_id' +
      ' WHERE sri.product_id = ?' + dw('sr.return_date'), [product_id]);
    const rawSales = await query(
      'SELECT rsi.sale_id as ref_id, rs.sale_number as ref_number, rs.sale_date as txn_date,' +
      " 'Raw Sale' as txn_type, 'OUT' as direction," +
      ' rsi.quantity as qty, rsi.unit_price,' +
      ' rsi.quantity * rsi.unit_price as amount,' +
      " COALESCE(rs.customer_name, sec.section_name) as party, COALESCE(rs.notes,'') as notes" +
      ' FROM raw_sale_items rsi' +
      ' JOIN raw_sales rs ON rsi.sale_id = rs.sale_id' +
      ' JOIN sections sec ON rs.section_id = sec.section_id' +
      ' WHERE rsi.product_id = ?' + dw('rs.sale_date'), [product_id]);
    const all = [...purchases, ...purchaseReturns, ...issues, ...stockReturns, ...rawSales]
      .sort((a, b) => new Date(a.txn_date) - new Date(b.txn_date) || Number(a.ref_id) - Number(b.ref_id));
    let balance = 0;
    const ledger = all.map(row => {
      const qty = Number(row.qty);
      if (row.direction === 'IN') balance += qty; else balance -= qty;
      return { ...row, qty, running_balance: balance };
    });
    const [product] = await query('SELECT product_name, barcode, stock_quantity FROM products WHERE product_id = ?', [product_id]);
    res.json({ product: product || null, ledger });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.itemWisePurchase = async (req, res) => {
  try {
    const { from_date, to_date, supplier_id } = req.query;
    const branch = branchWhere(req, 'p');
    let where = 'WHERE 1=1' + branch.clause; const params = [...branch.params];
    if (from_date)   { where += ' AND pv.voucher_date >= ?';  params.push(from_date); }
    if (to_date)     { where += ' AND pv.voucher_date <= ?';  params.push(to_date); }
    if (supplier_id) { where += ' AND pv.supplier_id = ?';    params.push(supplier_id); }
    const rows = await query(
      'SELECT p.product_id, p.product_name, p.product_type,' +
      ' COUNT(DISTINCT pvi.pv_id) as voucher_count,' +
      ' SUM(pvi.quantity_received) as total_qty,' +
      ' SUM(pvi.total_price) as total_amount,' +
      ' AVG(pvi.unit_price) as avg_unit_price' +
      ' FROM inv_purchase_voucher_items pvi' +
      ' JOIN inv_purchase_vouchers pv ON pvi.pv_id = pv.pv_id' +
      ' JOIN products p ON pvi.product_id = p.product_id' +
      ' ' + where +
      ' GROUP BY p.product_id, p.product_name, p.product_type ORDER BY total_amount DESC', params);
    const [totals] = await query(
      'SELECT SUM(pvi.total_price) as grand_total, SUM(pvi.quantity_received) as grand_qty' +
      ' FROM inv_purchase_voucher_items pvi' +
      ' JOIN inv_purchase_vouchers pv ON pvi.pv_id = pv.pv_id' +
      ' JOIN products p ON pvi.product_id = p.product_id ' + where, params);
    res.json({
      data: rows.map(r => ({ ...r, total_qty: Number(r.total_qty), total_amount: Number(r.total_amount), avg_unit_price: Number(r.avg_unit_price) })),
      totals: { grand_total: Number((totals || {}).grand_total || 0), grand_qty: Number((totals || {}).grand_qty || 0) }
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.supplierWise = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const params = [];
    let dateW = '';
    if (from_date) { dateW += ' AND pv.voucher_date >= ?'; params.push(from_date); }
    if (to_date)   { dateW += ' AND pv.voucher_date <= ?'; params.push(to_date); }

    // Get all PVs with their payable account (via JE CR lines)
    const pvRows = await query(`
      SELECT
        pv.pv_id, pv.pv_number, pv.voucher_date,
        pv.total_amount, pv.shipping_cost, pv.extra_charges, pv.other_charges
        ,jel.account_id  AS payable_account_id
        ,acc.account_name AS supplier_name
      FROM inv_purchase_vouchers pv
      JOIN journal_entries je
        ON je.reference_type = 'purchase_voucher' AND je.reference_id = pv.pv_id
      JOIN journal_entry_lines jel
        ON jel.entry_id = je.entry_id AND jel.credit > 0
      JOIN accounts acc
        ON acc.account_id = jel.account_id
      WHERE 1=1 ${dateW}
      ORDER BY acc.account_name, pv.voucher_date, pv.pv_id
    `, params);

    if (!pvRows.length) return res.json({ data: [], grand_total: 0 });

    const pvIds = pvRows.map(r => r.pv_id);
    const placeholders = pvIds.map(() => '?').join(',');

    const itemRows = await query(`
      SELECT
        pvd.pv_id,
        p.product_name,
        p.unit,
        pvd.quantity_received AS qty,
        pvd.unit_price        AS rate,
        (pvd.quantity_received * pvd.unit_price) AS amount
      FROM inv_purchase_voucher_items pvd
      JOIN products p ON pvd.product_id = p.product_id
      WHERE pvd.pv_id IN (${placeholders})
      ORDER BY pvd.item_id
    `, pvIds);

    // Map items by pv_id
    const itemsByPv = {};
    itemRows.forEach(r => {
      if (!itemsByPv[r.pv_id]) itemsByPv[r.pv_id] = [];
      itemsByPv[r.pv_id].push(r);
    });

    // Group PVs by payable account
    const supplierMap = {};
    pvRows.forEach(pv => {
      const key = pv.payable_account_id;
      if (!supplierMap[key]) {
        supplierMap[key] = {
          supplier_id: key,
          supplier_name: pv.supplier_name,
          pv_count: 0,
          total_amount: 0,
          items: [],
        };
      }
      const s = supplierMap[key];
      s.pv_count++;
      s.total_amount += Number(pv.total_amount);

      (itemsByPv[pv.pv_id] || []).forEach(item => {
        s.items.push({
          product_name: item.product_name,
          unit:         item.unit  || '',
          qty:          Number(item.qty),
          rate:         Number(item.rate),
          amount:       Number(item.amount),
          carriage:     0,
          net_amount:   Number(item.amount),
        });
      });

      // Add carriage row if PV has shipping/extra/other charges
      const carriage = Number(pv.shipping_cost || 0) + Number(pv.extra_charges || 0) + Number(pv.other_charges || 0);
      if (carriage > 0) {
        s.items.push({
          product_name: `Carriage / Shipping (${pv.pv_number})`,
          unit: '', qty: null, rate: null,
          amount: 0, carriage, net_amount: carriage,
          is_carriage: true,
        });
      }
    });

    const data = Object.values(supplierMap).sort((a, b) =>
      a.supplier_name.localeCompare(b.supplier_name)
    );

    const grand_total = data.reduce((s, r) => s + r.total_amount, 0);
    const grand_items = data.reduce((s, r) => s + r.items.filter(i => !i.is_carriage).reduce((a, b) => a + b.amount, 0), 0);
    const grand_carriage = data.reduce((s, r) => s + r.items.filter(i => i.is_carriage).reduce((a, b) => a + b.carriage, 0), 0);

    res.json({ data, grand_total, grand_items, grand_carriage });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.issuanceSummary = async (req, res) => {
  try {
    const { from_date, to_date, section_id } = req.query;
    const buildWhere = (dateCol) => {
      let w = 'WHERE 1=1'; const p = [];
      if (from_date)  { w += ' AND ' + dateCol + ' >= ?'; p.push(from_date); }
      if (to_date)    { w += ' AND ' + dateCol + ' <= ?'; p.push(to_date); }
      if (section_id) { w += ' AND section_id = ?';       p.push(section_id); }
      return { w, p };
    };
    const { w: iw, p: ip } = buildWhere('issue_date');
    const { w: rw, p: rp } = buildWhere('return_date');
    const { w: sw, p: sp } = buildWhere('sale_date');
    const [[issueStats], [returnStats], [saleStats]] = await Promise.all([
      query('SELECT COUNT(DISTINCT si.issue_id) as cnt, COALESCE(SUM(sii.quantity * sii.unit_cost),0) as total FROM stock_issues si LEFT JOIN stock_issue_items sii ON si.issue_id = sii.issue_id ' + iw, ip),
      query('SELECT COUNT(*) as cnt FROM stock_issue_returns ' + rw, rp),
      query('SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM raw_sales ' + sw, sp),
    ]);
    const { w: iw2, p: ip2 } = buildWhere('si.issue_date');
    const topIssued = await query(
      'SELECT p.product_name, SUM(sii.quantity) as total_qty, SUM(sii.quantity * sii.unit_cost) as total_cost' +
      ' FROM stock_issue_items sii' +
      ' JOIN stock_issues si ON sii.issue_id = si.issue_id' +
      ' JOIN products p ON sii.product_id = p.product_id' +
      ' ' + iw2 + ' GROUP BY p.product_id, p.product_name ORDER BY total_qty DESC LIMIT 10', ip2);
    res.json({
      summary: {
        issues:    { count: Number((issueStats || {}).cnt || 0),  amount: Number((issueStats || {}).total || 0) },
        returns:   { count: Number((returnStats || {}).cnt || 0) },
        raw_sales: { count: Number((saleStats || {}).cnt || 0),   amount: Number((saleStats || {}).total || 0) },
      },
      top_issued_products: topIssued.map(r => ({ ...r, total_qty: Number(r.total_qty), total_cost: Number(r.total_cost) })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.stockReconciliation = async (req, res) => {
  try {
    const branch = branchWhere(req, 'p');
    const bClause = branch.clause ? `AND p.branch_id = ?` : '';
    const rows = await query(
      'SELECT p.product_id, p.product_name, p.product_type, p.barcode,' +
      ' COALESCE(inv.available_stock, 0) as current_stock,' +
      ' COALESCE(p.min_stock_level, 0) as min_stock,' +
      ' p.cost_price,' +
      ' (SELECT COALESCE(SUM(pvi.quantity_received),0) FROM inv_purchase_voucher_items pvi WHERE pvi.product_id = p.product_id) as total_purchased,' +
      ' (SELECT COALESCE(SUM(pri.quantity_returned),0) FROM purchase_return_items pri WHERE pri.product_id = p.product_id) as total_purchase_returns,' +
      ' (SELECT COALESCE(SUM(sii.quantity),0) FROM stock_issue_items sii WHERE sii.product_id = p.product_id) as total_issued,' +
      ' (SELECT COALESCE(SUM(sri.quantity),0) FROM stock_issue_return_items sri WHERE sri.product_id = p.product_id) as total_issue_returns,' +
      ' (SELECT COALESCE(SUM(rsi.quantity),0) FROM raw_sale_items rsi WHERE rsi.product_id = p.product_id) as total_raw_sold' +
      ' FROM products p' +
      ' LEFT JOIN inventory inv ON p.product_id = inv.product_id' +
      ` WHERE p.is_active = 1 ${bClause} ORDER BY p.product_name`, branch.params);
    res.json({ data: rows.map(r => ({
      ...r,
      current_stock: Number(r.current_stock),
      total_purchased: Number(r.total_purchased),
      total_purchase_returns: Number(r.total_purchase_returns),
      total_issued: Number(r.total_issued),
      total_issue_returns: Number(r.total_issue_returns),
      total_raw_sold: Number(r.total_raw_sold),
    })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getLowStock = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const branch = branchWhere(req, 'p');
    const rows = await query(`
      SELECT p.product_id, p.product_name, p.sku,
             COALESCE(i.available_stock, 0) as stock_quantity,
             COALESCE(p.min_stock_level, 10) as min_stock_level,
             c.category_name
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.is_active = 1
        AND COALESCE(i.available_stock, 0) <= COALESCE(p.min_stock_level, 10)
        ${branch.clause}
      ORDER BY COALESCE(i.available_stock, 0) ASC
      LIMIT ?
    `, [...branch.params, parseInt(limit)]);
    res.json({ data: rows.map(r => ({ ...r, stock_quantity: Number(r.stock_quantity), min_stock_level: Number(r.min_stock_level) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.slowMovingStock = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const rows = await query(`
      SELECT
        p.product_id, p.product_name, p.unit,
        c.category_name,
        COALESCE(inv.available_stock, p.stock_quantity, 0) AS current_stock,
        COALESCE(p.cost_price, 0) AS cost_price,
        MAX(act.last_date) AS last_activity_date,
        DATEDIFF(CURDATE(), MAX(act.last_date)) AS days_inactive
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN inventory inv ON inv.product_id = p.product_id
      LEFT JOIN (
        SELECT pvd.product_id, pv.voucher_date AS last_date
        FROM inv_purchase_voucher_items pvd
        JOIN inv_purchase_vouchers pv ON pvd.pv_id = pv.pv_id
        UNION ALL
        SELECT sii.product_id, si.issue_date AS last_date
        FROM stock_issue_items sii
        JOIN stock_issues si ON sii.issue_id = si.issue_id
        UNION ALL
        SELECT sd.product_id, s.sale_date AS last_date
        FROM sale_details sd
        JOIN sales s ON sd.sale_id = s.sale_id
      ) act ON act.product_id = p.product_id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
        AND COALESCE(inv.available_stock, p.stock_quantity, 0) > 0
      GROUP BY p.product_id, p.product_name, p.unit, c.category_name, inv.available_stock, p.stock_quantity, p.cost_price
      HAVING MAX(act.last_date) IS NULL OR DATEDIFF(CURDATE(), MAX(act.last_date)) >= ?
      ORDER BY CASE WHEN MAX(act.last_date) IS NULL THEN 0 ELSE 1 END ASC, days_inactive DESC
    `, [days]);
    res.json({ data: rows.map(r => ({
      ...r,
      current_stock: Number(r.current_stock),
      cost_price: Number(r.cost_price),
      days_inactive: r.days_inactive !== null ? Number(r.days_inactive) : null,
      value_at_risk: Number(r.current_stock) * Number(r.cost_price),
    })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.fastMovingItems = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const p1 = [], p2 = [];
    let dw1 = '1=1', dw2 = '1=1';
    if (from_date) { dw1 += ' AND pv.voucher_date >= ?'; p1.push(from_date); dw2 += ' AND si.issue_date >= ?'; p2.push(from_date); }
    if (to_date)   { dw1 += ' AND pv.voucher_date <= ?'; p1.push(to_date);   dw2 += ' AND si.issue_date <= ?'; p2.push(to_date); }

    const rows = await query(`
      SELECT
        p.product_id, p.product_name, p.unit, c.category_name,
        COALESCE(purch.qty, 0) AS total_purchased,
        COALESCE(purch.pv_count, 0) AS purchase_vouchers,
        COALESCE(iss.qty, 0) AS total_issued,
        COALESCE(iss.issue_count, 0) AS issue_transactions,
        COALESCE(purch.qty, 0) + COALESCE(iss.qty, 0) AS total_movement
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT pvd.product_id,
               SUM(pvd.quantity_received) AS qty,
               COUNT(DISTINCT pvd.pv_id) AS pv_count
        FROM inv_purchase_voucher_items pvd
        JOIN inv_purchase_vouchers pv ON pvd.pv_id = pv.pv_id
        WHERE ${dw1}
        GROUP BY pvd.product_id
      ) purch ON purch.product_id = p.product_id
      LEFT JOIN (
        SELECT sii.product_id,
               SUM(sii.quantity) AS qty,
               COUNT(DISTINCT sii.issue_id) AS issue_count
        FROM stock_issue_items sii
        JOIN stock_issues si ON sii.issue_id = si.issue_id
        WHERE ${dw2}
        GROUP BY sii.product_id
      ) iss ON iss.product_id = p.product_id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
        AND (purch.product_id IS NOT NULL OR iss.product_id IS NOT NULL)
      ORDER BY total_movement DESC
      LIMIT ?
    `, [...p1, ...p2, limit]);

    res.json({ data: rows.map(r => ({
      ...r,
      total_purchased: Number(r.total_purchased),
      total_issued: Number(r.total_issued),
      total_movement: Number(r.total_movement),
    })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.purchaseVsIssuance = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const p1 = [], p2 = [];
    let dw1 = '1=1', dw2 = '1=1';
    if (from_date) { dw1 += ' AND pv.voucher_date >= ?'; p1.push(from_date); dw2 += ' AND si.issue_date >= ?'; p2.push(from_date); }
    if (to_date)   { dw1 += ' AND pv.voucher_date <= ?'; p1.push(to_date);   dw2 += ' AND si.issue_date <= ?'; p2.push(to_date); }

    const rows = await query(`
      SELECT
        p.product_id, p.product_name, p.unit, c.category_name,
        COALESCE(purch.qty, 0)  AS purchased,
        COALESCE(purch.amount, 0) AS purchase_amount,
        COALESCE(iss.qty, 0)    AS issued,
        COALESCE(iss.amount, 0) AS issue_amount,
        COALESCE(purch.qty, 0) - COALESCE(iss.qty, 0) AS difference
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT pvd.product_id,
               SUM(pvd.quantity_received) AS qty,
               SUM(pvd.quantity_received * pvd.unit_price) AS amount
        FROM inv_purchase_voucher_items pvd
        JOIN inv_purchase_vouchers pv ON pvd.pv_id = pv.pv_id
        WHERE ${dw1}
        GROUP BY pvd.product_id
      ) purch ON purch.product_id = p.product_id
      LEFT JOIN (
        SELECT sii.product_id,
               SUM(sii.quantity) AS qty,
               SUM(sii.quantity * sii.unit_cost) AS amount
        FROM stock_issue_items sii
        JOIN stock_issues si ON sii.issue_id = si.issue_id
        WHERE ${dw2}
        GROUP BY sii.product_id
      ) iss ON iss.product_id = p.product_id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
        AND (purch.product_id IS NOT NULL OR iss.product_id IS NOT NULL)
      ORDER BY p.product_name
    `, [...p1, ...p2]);

    res.json({ data: rows.map(r => ({
      ...r,
      purchased: Number(r.purchased),
      purchase_amount: Number(r.purchase_amount),
      issued: Number(r.issued),
      issue_amount: Number(r.issue_amount),
      difference: Number(r.difference),
    })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.openingClosingStock = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const p1 = [], p2 = [], p3 = [];
    let dw1 = '1=1', dw2 = '1=1', dw3 = '1=1';
    if (from_date) { dw1 += ' AND pv.voucher_date >= ?'; p1.push(from_date); dw2 += ' AND si.issue_date >= ?'; p2.push(from_date); dw3 += ' AND s.sale_date >= ?'; p3.push(from_date); }
    if (to_date)   { dw1 += ' AND pv.voucher_date <= ?'; p1.push(to_date);   dw2 += ' AND si.issue_date <= ?'; p2.push(to_date);   dw3 += ' AND s.sale_date <= ?'; p3.push(to_date); }

    const rows = await query(`
      SELECT
        p.product_id, p.product_name, p.unit, c.category_name,
        COALESCE(inv.available_stock, p.stock_quantity, 0) AS closing_stock,
        COALESCE(purch.qty, 0)  AS purchases_in_period,
        COALESCE(iss.qty, 0)    AS issues_in_period,
        COALESCE(sold.qty, 0)   AS sales_in_period,
        COALESCE(inv.available_stock, p.stock_quantity, 0)
          - COALESCE(purch.qty, 0)
          + COALESCE(iss.qty, 0)
          + COALESCE(sold.qty, 0) AS opening_stock,
        COALESCE(p.cost_price, 0) AS cost_price
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN inventory inv ON inv.product_id = p.product_id
      LEFT JOIN (
        SELECT pvd.product_id, SUM(pvd.quantity_received) AS qty
        FROM inv_purchase_voucher_items pvd
        JOIN inv_purchase_vouchers pv ON pvd.pv_id = pv.pv_id
        WHERE ${dw1} GROUP BY pvd.product_id
      ) purch ON purch.product_id = p.product_id
      LEFT JOIN (
        SELECT sii.product_id, SUM(sii.quantity) AS qty
        FROM stock_issue_items sii
        JOIN stock_issues si ON sii.issue_id = si.issue_id
        WHERE ${dw2} GROUP BY sii.product_id
      ) iss ON iss.product_id = p.product_id
      LEFT JOIN (
        SELECT sd.product_id, SUM(sd.quantity) AS qty
        FROM sale_details sd
        JOIN sales s ON sd.sale_id = s.sale_id
        WHERE ${dw3} GROUP BY sd.product_id
      ) sold ON sold.product_id = p.product_id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
      ORDER BY p.product_name
    `, [...p1, ...p2, ...p3]);

    res.json({ data: rows.map(r => ({
      ...r,
      closing_stock: Number(r.closing_stock),
      opening_stock: Number(r.opening_stock),
      purchases_in_period: Number(r.purchases_in_period),
      issues_in_period: Number(r.issues_in_period),
      sales_in_period: Number(r.sales_in_period),
      cost_price: Number(r.cost_price),
    })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.reorderAlert = async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        p.product_id, p.product_name, p.unit, c.category_name,
        COALESCE(inv.available_stock, p.stock_quantity, 0) AS current_stock,
        COALESCE(p.min_stock_level, 0) AS reorder_level,
        COALESCE(p.cost_price, 0) AS cost_price,
        COALESCE(usage30.avg_daily, 0) AS avg_daily_usage,
        CASE
          WHEN COALESCE(usage30.avg_daily, 0) > 0
          THEN ROUND(COALESCE(inv.available_stock, p.stock_quantity, 0) / usage30.avg_daily)
          ELSE NULL
        END AS days_remaining
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN inventory inv ON inv.product_id = p.product_id
      LEFT JOIN (
        SELECT sii.product_id,
               SUM(sii.quantity) / 30.0 AS avg_daily
        FROM stock_issue_items sii
        JOIN stock_issues si ON sii.issue_id = si.issue_id
        WHERE si.issue_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY sii.product_id
      ) usage30 ON usage30.product_id = p.product_id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
        AND COALESCE(inv.available_stock, p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 0)
      ORDER BY current_stock ASC
    `);

    res.json({ data: rows.map(r => ({
      ...r,
      current_stock: Number(r.current_stock),
      reorder_level: Number(r.reorder_level),
      cost_price: Number(r.cost_price),
      avg_daily_usage: Number(r.avg_daily_usage),
      days_remaining: r.days_remaining !== null ? Number(r.days_remaining) : null,
    })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.categoryWisePurchase = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const params = [];
    let dateW = '1=1';
    if (from_date) { dateW += ' AND pv.voucher_date >= ?'; params.push(from_date); }
    if (to_date)   { dateW += ' AND pv.voucher_date <= ?'; params.push(to_date); }

    const rows = await query(`
      SELECT
        c.category_id, c.category_name,
        COUNT(DISTINCT p.product_id) AS product_count,
        COUNT(DISTINCT pv.pv_id)    AS voucher_count,
        SUM(pvd.quantity_received)  AS total_qty,
        SUM(pvd.quantity_received * pvd.unit_price) AS total_amount
      FROM categories c
      JOIN products p ON p.category_id = c.category_id AND p.is_active = 1
      JOIN inv_purchase_voucher_items pvd ON pvd.product_id = p.product_id
      JOIN inv_purchase_vouchers pv ON pvd.pv_id = pv.pv_id
      WHERE ${dateW}
      GROUP BY c.category_id, c.category_name
      ORDER BY total_amount DESC
    `, params);

    const grand_total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
    res.json({ data: rows.map(r => ({
      ...r,
      product_count: Number(r.product_count),
      voucher_count: Number(r.voucher_count),
      total_qty: Number(r.total_qty),
      total_amount: Number(r.total_amount),
    })), grand_total });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.rateHistory = async (req, res) => {
  try {
    const { product_id, from_date, to_date } = req.query;
    if (!product_id) return res.status(400).json({ message: 'product_id is required' });
    const params = [product_id];
    let dateW = '';
    if (from_date) { dateW += ' AND pv.voucher_date >= ?'; params.push(from_date); }
    if (to_date)   { dateW += ' AND pv.voucher_date <= ?'; params.push(to_date); }

    const [product] = await query('SELECT product_name, unit FROM products WHERE product_id = ?', [product_id]);

    const rows = await query(`
      SELECT
        pv.voucher_date, pv.pv_number,
        COALESCE(acc.account_name, 'Unknown') AS supplier_name,
        pvd.quantity_received AS qty,
        pvd.unit_price AS rate,
        pvd.quantity_received * pvd.unit_price AS amount
      FROM inv_purchase_voucher_items pvd
      JOIN inv_purchase_vouchers pv ON pvd.pv_id = pv.pv_id
      LEFT JOIN journal_entries je ON je.reference_type = 'purchase_voucher' AND je.reference_id = pv.pv_id
      LEFT JOIN journal_entry_lines jel ON jel.entry_id = je.entry_id AND jel.credit > 0
      LEFT JOIN accounts acc ON acc.account_id = COALESCE(pv.payable_account_id, jel.account_id)
      WHERE pvd.product_id = ? ${dateW}
      ORDER BY pv.voucher_date DESC, pv.pv_id DESC
    `, params);

    res.json({
      product,
      data: rows.map(r => ({
        ...r,
        qty: Number(r.qty),
        rate: Number(r.rate),
        amount: Number(r.amount),
      }))
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};
