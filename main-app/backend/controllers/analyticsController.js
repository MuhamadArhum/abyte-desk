const logger = require('../config/logger');
const { query } = require('../config/database');

function getBranchFilter(req, alias) {
  const col = alias ? `${alias}.branch_id` : 'branch_id';
  if (req.user.role_name !== 'Admin' && req.user.branch_id) {
    return { clause: ` AND ${col} = ?`, param: req.user.branch_id };
  } else if (req.user.role_name === 'Admin' && req.query.filter_branch) {
    return { clause: ` AND ${col} = ?`, param: req.query.filter_branch };
  }
  return { clause: '', param: null };
}

exports.getCustomerAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const bf = getBranchFilter(req);
    const params = [start_date, end_date, ...(bf.param ? [bf.param] : [])];

    const topCustomers = await query(`
      SELECT
        COALESCE(customer_name, 'Walk-in') as customer_name,
        COUNT(*) as total_orders,
        SUM(net_amount) as total_spent,
        AVG(net_amount) as avg_order_value,
        MAX(sale_date) as last_purchase
      FROM sales
      WHERE sale_date BETWEEN ? AND ?${bf.clause}
      GROUP BY COALESCE(customer_name, 'Walk-in')
      ORDER BY total_spent DESC
      LIMIT 10
    `, params);

    const [customerCounts] = await query(`
      SELECT
        COUNT(DISTINCT CASE WHEN customer_name IS NOT NULL AND customer_name != '' THEN customer_name END) as named_customers,
        COUNT(CASE WHEN customer_name IS NULL OR customer_name = '' THEN 1 END) as walkin_count,
        COUNT(*) as total_transactions
      FROM sales
      WHERE sale_date BETWEEN ? AND ?${bf.clause}
    `, params);

    res.json({ top_customers: topCustomers, summary: customerCounts || {} });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPaymentMethods = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const bf = getBranchFilter(req);
    const params = [start_date, end_date, ...(bf.param ? [bf.param] : [])];

    const methods = await query(`
      SELECT
        COALESCE(payment_method, 'Cash') as payment_method,
        COUNT(*) as transaction_count,
        SUM(net_amount) as total_amount,
        ROUND(SUM(net_amount) * 100.0 / SUM(SUM(net_amount)) OVER (), 1) as percentage
      FROM sales
      WHERE sale_date BETWEEN ? AND ?${bf.clause}
      GROUP BY COALESCE(payment_method, 'Cash')
      ORDER BY total_amount DESC
    `, params);

    res.json({ data: methods });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getHourlySales = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const bf = getBranchFilter(req);
    const params = [start_date, end_date, ...(bf.param ? [bf.param] : [])];

    const hourly = await query(`
      SELECT
        HOUR(sale_date) as hour,
        COUNT(*) as transaction_count,
        SUM(net_amount) as total_sales
      FROM sales
      WHERE sale_date BETWEEN ? AND ?${bf.clause}
      GROUP BY HOUR(sale_date)
      ORDER BY hour ASC
    `, params);

    const allHours = Array.from({ length: 24 }, (_, h) => {
      const found = hourly.find(r => Number(r.hour) === h);
      const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      return { hour: h, label, transaction_count: Number(found?.transaction_count || 0), total_sales: Number(found?.total_sales || 0) };
    });

    res.json({ data: allHours });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const bf = getBranchFilter(req, 's');
    const salesParams = [start_date, end_date, ...(bf.param ? [bf.param] : [])];

    const [salesStats] = await query(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_sales,
        SUM(discount) as total_discount,
        SUM(net_amount) as net_sales,
        AVG(net_amount) as avg_transaction
      FROM sales s
      WHERE sale_date BETWEEN ? AND ?${bf.clause}
    `, salesParams);

    const [expenseStats] = await query(`
      SELECT SUM(amount) as total_expenses
      FROM expenses
      WHERE expense_date BETWEEN ? AND ?
    `, [start_date, end_date]);

    const topProducts = await query(`
      SELECT p.product_name, SUM(sd.quantity) as units_sold, SUM(sd.total_price) as revenue
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      JOIN sales s ON sd.sale_id = s.sale_id
      WHERE s.sale_date BETWEEN ? AND ?${bf.clause}
      GROUP BY sd.product_id, p.product_name
      ORDER BY revenue DESC
      LIMIT 5
    `, salesParams);

    const profit = (salesStats?.net_sales || 0) - (expenseStats?.total_expenses || 0);

    res.json({
      sales: salesStats || {},
      expenses: expenseStats || {},
      profit,
      topProducts
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalesTrend = async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ message: 'Invalid period. Must be daily, weekly, or monthly.' });
    }
    const bf = getBranchFilter(req);
    const params = [start_date, end_date, ...(bf.param ? [bf.param] : [])];

    let groupBy;
    if (period === 'daily') groupBy = 'DATE(sale_date)';
    else if (period === 'weekly') groupBy = 'YEARWEEK(sale_date)';
    else groupBy = 'DATE_FORMAT(sale_date, "%Y-%m")';

    const trend = await query(`
      SELECT
        ${groupBy} as period,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_sales,
        SUM(net_amount) as net_sales
      FROM sales
      WHERE sale_date BETWEEN ? AND ?${bf.clause}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);

    res.json({ data: trend });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const bf = getBranchFilter(req, 's');
    const params = [start_date, end_date, ...(bf.param ? [bf.param] : [])];

    const breakdown = await query(`
      SELECT c.category_name, SUM(sd.total_price) as revenue, SUM(sd.quantity) as units_sold
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN sales s ON sd.sale_id = s.sale_id
      WHERE s.sale_date BETWEEN ? AND ?${bf.clause}
      GROUP BY c.category_id, c.category_name
      ORDER BY revenue DESC
    `, params);

    res.json({ data: breakdown });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
