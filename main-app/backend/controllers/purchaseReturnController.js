const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const pad = (n) => String(n).padStart(6, '0');

async function nextPRNumber() {
  const [last] = await query('SELECT pr_number FROM purchase_returns ORDER BY pr_id DESC LIMIT 1');
  if (last?.pr_number) {
    const m = last.pr_number.match(/\d+$/);
    if (m) return `PR${pad(parseInt(m[0]) + 1)}`;
  }
  return `PR${pad(1)}`;
}

// GET all purchase returns
exports.getAll = async (req, res) => {
  try {
    const { supplier_id, from_date, to_date } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (supplier_id) { where += ' AND pr.supplier_id = ?';   params.push(supplier_id); }
    if (from_date)   { where += ' AND pr.return_date >= ?';  params.push(from_date); }
    if (to_date)     { where += ' AND pr.return_date <= ?';  params.push(to_date); }

    const sql = `SELECT pr.*, s.supplier_name, u.name as created_by_name,
                   pv.pv_number, COUNT(pri.item_id) as item_count
                 FROM purchase_returns pr
                 LEFT JOIN suppliers s ON pr.supplier_id = s.supplier_id
                 LEFT JOIN inv_purchase_vouchers pv ON pr.pv_id = pv.pv_id
                 JOIN users u ON pr.created_by = u.user_id
                 LEFT JOIN purchase_return_items pri ON pr.pr_id = pri.pr_id
                 ${where} GROUP BY pr.pr_id ORDER BY pr.return_date DESC, pr.created_at DESC
                 LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM purchase_returns pr ${where}`;

    const [rows, [{total}]] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);
    res.json({ data: rows, pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) } });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET by ID
exports.getById = async (req, res) => {
  try {
    const [pr] = await query(
      `SELECT pr.*, s.supplier_name, u.name as created_by_name, pv.pv_number
       FROM purchase_returns pr
       LEFT JOIN suppliers s ON pr.supplier_id = s.supplier_id
       LEFT JOIN inv_purchase_vouchers pv ON pr.pv_id = pv.pv_id
       JOIN users u ON pr.created_by = u.user_id
       WHERE pr.pr_id = ?`, [req.params.id]
    );
    if (!pr) return res.status(404).json({ message: 'Not found' });
    const items = await query(
      `SELECT pri.*, p.product_name, p.barcode
       FROM purchase_return_items pri
       JOIN products p ON pri.product_id = p.product_id
       WHERE pri.pr_id = ?`, [req.params.id]
    );
    res.json({ ...pr, items });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// CREATE purchase return (deducts stock)
exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    const { pv_id, supplier_id, return_date, notes, items } = req.body;
    if (!return_date || !items?.length) {
      return res.status(400).json({ message: 'return_date and items are required' });
    }

    await conn.beginTransaction();
    const pr_number = await nextPRNumber();
    const total = items.reduce((s, i) => s + Number(i.quantity_returned) * Number(i.unit_price), 0);

    const result = await conn.query(
      'INSERT INTO purchase_returns (pr_number, pv_id, supplier_id, return_date, total_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [pr_number, pv_id || null, supplier_id || null, return_date, total, notes || null, req.user.user_id]
    );
    const prId = Number(result.insertId);

    for (const item of items) {
      const qty = Number(item.quantity_returned);
      if (qty <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: `Return quantity must be greater than 0 for product ${item.product_id}` });
      }
      // Lock inventory row and check stock before deducting
      const [inv] = await conn.query(
        'SELECT available_stock FROM inventory WHERE product_id = ? FOR UPDATE',
        [item.product_id]
      );
      if (!inv || Number(inv.available_stock) < qty) {
        await conn.rollback();
        return res.status(400).json({
          message: `Insufficient stock to return for product ${item.product_id} (available: ${inv?.available_stock ?? 0})`,
        });
      }
      const totalPrice = qty * Number(item.unit_price);
      await conn.query(
        'INSERT INTO purchase_return_items (pr_id, product_id, quantity_returned, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [prId, item.product_id, qty, item.unit_price, totalPrice]
      );
      // Deduct from inventory (returning to supplier)
      await conn.query('UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?', [qty, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [qty, item.product_id]);
    }

    // Update supplier balance (reduce outstanding payable)
    if (supplier_id) {
      await conn.query('UPDATE suppliers SET balance = balance - ? WHERE supplier_id = ?', [total, supplier_id]);
    }

    // Create reverse journal entry if PV has account links
    if (pv_id) {
      const [pv] = await conn.query(
        'SELECT payable_account_id, purchase_account_id FROM inv_purchase_vouchers WHERE pv_id = ?',
        [pv_id]
      );
      if (pv && pv.payable_account_id) {
        const [lastJE] = await conn.query("SELECT entry_number FROM journal_entries ORDER BY entry_id DESC LIMIT 1");
        let nextNum = 1;
        if (lastJE?.entry_number) { const m = lastJE.entry_number.match(/\d+$/); if (m) nextNum = parseInt(m[0]) + 1; }
        const entryNumber = `JV${String(nextNum).padStart(6, '0')}`;

        const jeResult = await conn.query(
          `INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit, status, created_by, posted_at)
           VALUES (?, ?, 'purchase_return', ?, ?, ?, ?, 'posted', ?, NOW())`,
          [entryNumber, return_date, prId, `Purchase Return - ${pr_number}`, total, total, req.user.user_id]
        );
        const entryId = Number(jeResult.insertId);

        // DR: Payable account (liability decreases — DR reduces a CR-normal account)
        await conn.query(
          'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
          [entryId, pv.payable_account_id, `Purchase Return - ${pr_number}`, total]
        );
        // CR: Purchase account (expense reversal — CR reduces a DR-normal account)
        await conn.query(
          'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
          [entryId, pv.purchase_account_id, `Purchase Return - ${pr_number}`, total]
        );

        // Update account balances
        // Payable (liability): DR reduces it
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE account_id = ?', [total, pv.payable_account_id]);
        // Purchase (expense): CR reduces it
        await conn.query('UPDATE accounts SET current_balance = current_balance - ? WHERE account_id = ?', [total, pv.purchase_account_id]);
      }
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PURCHASE_RETURN_CREATED', 'purchase_returns', prId, { pr_number, total }, req.ip);
    res.status(201).json({ message: 'Purchase return created', pr_id: prId, pr_number });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

// DELETE purchase return (reverse stock)
exports.remove = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Fetch record and items inside transaction with lock (B-013)
    const prRows = await conn.query('SELECT * FROM purchase_returns WHERE pr_id = ? FOR UPDATE', [req.params.id]);
    if (!prRows[0]) { await conn.rollback(); return res.status(404).json({ message: 'Purchase return not found' }); }

    const items = await conn.query('SELECT * FROM purchase_return_items WHERE pr_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity_returned, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity_returned, item.product_id]);
    }
    await conn.query('DELETE FROM purchase_returns WHERE pr_id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Purchase return deleted and stock restored' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};
