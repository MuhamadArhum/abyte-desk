// =============================================================
// inventoryReportController.js - Inventory Reports Controller
// Generates stock summary, top products, category breakdown, slow movers,
// items ledger, item-wise purchase, and issuance summary reports.
// Used by: /api/inventory-reports routes
// =============================================================

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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.supplierWise = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    let pvW = 'WHERE pv.supplier_id IS NOT NULL', prW = 'WHERE pr.supplier_id IS NOT NULL';
    const pvP = [], prP = [];
    if (from_date) { pvW += ' AND pv.voucher_date >= ?'; pvP.push(from_date); prW += ' AND pr.return_date >= ?'; prP.push(from_date); }
    if (to_date)   { pvW += ' AND pv.voucher_date <= ?'; pvP.push(to_date);   prW += ' AND pr.return_date <= ?';  prP.push(to_date); }
    const purchases = await query(
      'SELECT s.supplier_id, s.supplier_name, COUNT(DISTINCT pv.pv_id) as pv_count, SUM(pv.total_amount) as purchased' +
      ' FROM inv_purchase_vouchers pv' +
      ' JOIN suppliers s ON pv.supplier_id = s.supplier_id' +
      ' ' + pvW + ' GROUP BY s.supplier_id, s.supplier_name ORDER BY purchased DESC', pvP);
    const rets = await query(
      'SELECT s.supplier_id, SUM(pr.total_amount) as returned' +
      ' FROM purchase_returns pr' +
      ' JOIN suppliers s ON pr.supplier_id = s.supplier_id' +
      ' ' + prW + ' GROUP BY s.supplier_id', prP);
    const retMap = {};
    rets.forEach(r => { retMap[r.supplier_id] = Number(r.returned); });
    res.json({ data: purchases.map(p => ({
      ...p, purchased: Number(p.purchased),
      returned: retMap[p.supplier_id] || 0,
      net: Number(p.purchased) - (retMap[p.supplier_id] || 0),
    })) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};
