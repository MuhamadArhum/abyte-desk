const logger = require('../config/logger');
const { query } = require('../config/database');

function getBranchFilter(req) {
  if (req.user.role_name !== 'Admin' && req.user.branch_id) {
    return { clause: ' AND branch_id = ?', param: req.user.branch_id };
  } else if (req.user.role_name === 'Admin' && req.query.filter_branch) {
    return { clause: ' AND branch_id = ?', param: req.query.filter_branch };
  }
  return { clause: '', param: null };
}

exports.getSalesSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const [summary] = await query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(net_amount), 0) as total_sales,
        COALESCE(AVG(net_amount), 0) as avg_order,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}
    `, params);

    res.json({
      total_orders: Number(summary.total_orders) || 0,
      total_sales: Number(summary.total_sales) || 0,
      avg_order: Number(summary.avg_order) || 0,
      total_discount: Number(summary.total_discount) || 0,
      total_tax: Number(summary.total_tax) || 0
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getHourlySales = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [date, ...(bf.param ? [bf.param] : [])];

    const rows = await query(`
      SELECT HOUR(sale_date) as hour, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales WHERE status = 'completed' AND DATE(sale_date) = ?${bf.clause}
      GROUP BY HOUR(sale_date) ORDER BY hour
    `, params);

    const hourly = Array.from({ length: 24 }, (_, i) => {
      const found = rows.find(r => Number(r.hour) === i);
      return { hour: i, orders: found ? Number(found.orders) : 0, revenue: found ? Number(found.revenue) : 0 };
    });
    res.json({ data: hourly });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getPaymentBreakdown = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const rows = await query(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total
      FROM sales WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}
      GROUP BY payment_method ORDER BY total DESC
    `, params);

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    const data = rows.map(r => ({ method: r.payment_method, count: Number(r.count), total: Number(r.total), percentage: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0 }));
    res.json({ data });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCashierPerformance = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const rows = await query(`
      SELECT s.user_id, u.name as cashier_name, COUNT(*) as order_count,
        COALESCE(SUM(s.net_amount), 0) as total_sales, COALESCE(AVG(s.net_amount), 0) as avg_sale
      FROM sales s JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?${bf.clause ? bf.clause.replace('branch_id', 's.branch_id') : ''}
      GROUP BY s.user_id ORDER BY total_sales DESC
    `, params);

    res.json({ data: rows.map(r => ({ ...r, total_sales: Number(r.total_sales), avg_sale: Number(r.avg_sale), order_count: Number(r.order_count) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getDailyTrend = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const rows = await query(`
      SELECT DATE(sale_date) as date, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}
      GROUP BY DATE(sale_date) ORDER BY date
    `, params);

    res.json({ data: rows.map(r => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getTopCustomers = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const rows = await query(`
      SELECT s.customer_id, c.customer_name, COUNT(*) as order_count, COALESCE(SUM(s.net_amount), 0) as total_spent
      FROM sales s JOIN customers c ON s.customer_id = c.customer_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?${bf.clause ? bf.clause.replace('branch_id', 's.branch_id') : ''}
      GROUP BY s.customer_id ORDER BY total_spent DESC LIMIT 15
    `, params);

    res.json({ data: rows.map(r => ({ ...r, total_spent: Number(r.total_spent), order_count: Number(r.order_count) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getSalesComparison = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = new Date(date_from || new Date().toISOString().split('T')[0]);
    const to = new Date(date_to || new Date().toISOString().split('T')[0]);
    const days = Math.max(1, Math.ceil((to - from) / 86400000) + 1);
    const bf = getBranchFilter(req);

    const prevFrom = new Date(from.getTime() - days * 86400000).toISOString().split('T')[0];
    const prevTo = new Date(from.getTime() - 86400000).toISOString().split('T')[0];

    const currentParams = ['completed', from.toISOString().split('T')[0], to.toISOString().split('T')[0], ...(bf.param ? [bf.param] : [])];
    const prevParams = ['completed', prevFrom, prevTo, ...(bf.param ? [bf.param] : [])];

    const [[current], [previous]] = await Promise.all([
      query(`SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as orders FROM sales WHERE status = ? AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}`, currentParams),
      query(`SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as orders FROM sales WHERE status = ? AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}`, prevParams)
    ]);

    const currentTotal = Number(current.total);
    const prevTotal = Number(previous.total);
    const change = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0;

    res.json({ current_period: { total: currentTotal, orders: Number(current.orders) }, previous_period: { total: prevTotal, orders: Number(previous.orders) }, change_percent: change });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};


exports.getProfitMargin = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const bf   = getBranchFilter(req);
    const branchClause = bf.clause ? bf.clause.replace('branch_id', 's.branch_id') : '';
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const [summary] = await query(`
      SELECT
        COALESCE(SUM(sd.total_price), 0)                          as total_revenue,
        COALESCE(SUM(sd.quantity * p.cost_price), 0)              as total_cost,
        COALESCE(SUM(sd.total_price) - SUM(sd.quantity * p.cost_price), 0) as gross_profit
      FROM sale_details sd
      JOIN sales s    ON sd.sale_id    = s.sale_id
      JOIN products p ON sd.product_id = p.product_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ? AND p.cost_price IS NOT NULL${branchClause}
    `, params);

    const rows = await query(`
      SELECT
        p.product_id, p.product_name,
        COALESCE(c.category_name, 'Uncategorized') as category_name,
        SUM(sd.quantity)                                                         as total_qty,
        COALESCE(SUM(sd.total_price), 0)                                         as revenue,
        COALESCE(SUM(sd.quantity * p.cost_price), 0)                             as total_cost,
        COALESCE(SUM(sd.total_price) - SUM(sd.quantity * p.cost_price), 0)       as gross_profit,
        CASE WHEN SUM(sd.total_price) > 0
          THEN ROUND((SUM(sd.total_price) - SUM(sd.quantity * p.cost_price)) / SUM(sd.total_price) * 100, 1)
          ELSE 0 END                                                              as margin_pct
      FROM sale_details sd
      JOIN sales s    ON sd.sale_id    = s.sale_id
      JOIN products p ON sd.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ? AND p.cost_price IS NOT NULL${branchClause}
      GROUP BY p.product_id
      ORDER BY gross_profit DESC
    `, params);

    res.json({
      summary: {
        total_revenue: Number(summary.total_revenue),
        total_cost:    Number(summary.total_cost),
        gross_profit:  Number(summary.gross_profit),
        overall_margin: Number(summary.total_revenue) > 0
          ? Math.round((Number(summary.gross_profit) / Number(summary.total_revenue)) * 100)
          : 0,
      },
      data: rows.map(r => ({
        product_id:    Number(r.product_id),
        product_name:  r.product_name,
        category_name: r.category_name,
        total_qty:     Number(r.total_qty),
        revenue:       Number(r.revenue),
        total_cost:    Number(r.total_cost),
        gross_profit:  Number(r.gross_profit),
        margin_pct:    Number(r.margin_pct),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getDiscountAnalysis = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const bf   = getBranchFilter(req);
    const branchClause = bf.clause ? bf.clause.replace('branch_id', 's.branch_id') : '';
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const [summary] = await query(`
      SELECT
        COUNT(*)                                                           as total_orders,
        COUNT(CASE WHEN s.discount > 0 THEN 1 END)                        as discounted_orders,
        COALESCE(SUM(s.discount), 0)                                       as total_discount,
        COALESCE(SUM(s.total_amount), 0)                                   as gross_sales,
        CASE WHEN SUM(s.total_amount) > 0
          THEN ROUND(SUM(s.discount) / SUM(s.total_amount) * 100, 1)
          ELSE 0 END                                                        as discount_pct
      FROM sales s
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?${branchClause}
    `, params);

    const bycashier = await query(`
      SELECT
        s.user_id, u.name as cashier_name,
        COUNT(*)                                                              as total_orders,
        COUNT(CASE WHEN s.discount > 0 THEN 1 END)                           as discounted_orders,
        COALESCE(SUM(s.discount), 0)                                          as total_discount,
        COALESCE(SUM(s.total_amount), 0)                                      as gross_sales,
        CASE WHEN SUM(s.total_amount) > 0
          THEN ROUND(SUM(s.discount) / SUM(s.total_amount) * 100, 1)
          ELSE 0 END                                                           as discount_pct
      FROM sales s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?${branchClause}
      GROUP BY s.user_id
      ORDER BY total_discount DESC
    `, params);

    const daily = await query(`
      SELECT
        DATE(s.sale_date)                        as date,
        COALESCE(SUM(s.discount), 0)             as total_discount,
        COALESCE(SUM(s.total_amount), 0)         as gross_sales,
        COUNT(CASE WHEN s.discount > 0 THEN 1 END) as discounted_orders
      FROM sales s
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?${branchClause}
      GROUP BY DATE(s.sale_date)
      ORDER BY date
    `, params);

    res.json({
      summary: {
        total_orders:       Number(summary.total_orders),
        discounted_orders:  Number(summary.discounted_orders),
        total_discount:     Number(summary.total_discount),
        gross_sales:        Number(summary.gross_sales),
        discount_pct:       Number(summary.discount_pct),
      },
      by_cashier: bycashier.map(r => ({
        user_id:           Number(r.user_id),
        cashier_name:      r.cashier_name,
        total_orders:      Number(r.total_orders),
        discounted_orders: Number(r.discounted_orders),
        total_discount:    Number(r.total_discount),
        gross_sales:       Number(r.gross_sales),
        discount_pct:      Number(r.discount_pct),
      })),
      daily: daily.map(r => ({
        date:              r.date,
        total_discount:    Number(r.total_discount),
        gross_sales:       Number(r.gross_sales),
        discounted_orders: Number(r.discounted_orders),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getTaxReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const bf   = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const [summary] = await query(`
      SELECT
        COUNT(*)                                                               as total_orders,
        COUNT(CASE WHEN tax_amount > 0 THEN 1 END)                            as taxable_orders,
        COALESCE(SUM(total_amount), 0)                                         as gross_amount,
        COALESCE(SUM(discount), 0)                                             as total_discount,
        COALESCE(SUM(tax_amount), 0)                                           as tax_collected,
        COALESCE(SUM(net_amount), 0)                                           as net_amount,
        COALESCE(SUM(CASE WHEN tax_amount > 0 THEN net_amount ELSE 0 END), 0) as taxable_sales,
        COALESCE(SUM(CASE WHEN tax_amount = 0 THEN net_amount ELSE 0 END), 0) as non_taxable_sales
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}
    `, params);

    const daily = await query(`
      SELECT
        DATE(sale_date)                          as date,
        COUNT(*)                                  as total_orders,
        COALESCE(SUM(total_amount), 0)            as gross_amount,
        COALESCE(SUM(tax_amount), 0)              as tax_collected,
        COALESCE(SUM(net_amount), 0)              as net_amount
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}
      GROUP BY DATE(sale_date)
      ORDER BY date
    `, params);

    res.json({
      summary: {
        total_orders:      Number(summary.total_orders),
        taxable_orders:    Number(summary.taxable_orders),
        gross_amount:      Number(summary.gross_amount),
        total_discount:    Number(summary.total_discount),
        tax_collected:     Number(summary.tax_collected),
        net_amount:        Number(summary.net_amount),
        taxable_sales:     Number(summary.taxable_sales),
        non_taxable_sales: Number(summary.non_taxable_sales),
      },
      daily: daily.map(r => ({
        date:          r.date,
        total_orders:  Number(r.total_orders),
        gross_amount:  Number(r.gross_amount),
        tax_collected: Number(r.tax_collected),
        net_amount:    Number(r.net_amount),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const bf = getBranchFilter(req);
    const params = [from, to, ...(bf.param ? [bf.param] : [])];

    const rows = await query(`
      SELECT
        CASE
          WHEN order_type = 'dine_in'  THEN 'Dine-In'
          WHEN order_type = 'takeaway' THEN 'Takeaway'
          WHEN order_type = 'delivery' THEN 'Delivery'
          ELSE 'Walk-In'
        END as category,
        order_type,
        COUNT(*) as total_orders,
        COALESCE(SUM(net_amount), 0) as total_sales,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COALESCE(SUM(additional_charges_amount), 0) as total_charges,
        COALESCE(AVG(net_amount), 0) as avg_order
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?${bf.clause}
      GROUP BY order_type
      ORDER BY total_sales DESC
    `, params);

    res.json({
      data: rows.map(r => ({
        category: r.category,
        order_type: r.order_type,
        total_orders: Number(r.total_orders),
        total_sales: Number(r.total_sales),
        total_tax: Number(r.total_tax),
        total_charges: Number(r.total_charges),
        avg_order: Number(r.avg_order),
      }))
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};
