// =============================================================
// accountingController.js - Accounting & Chart of Accounts Controller
// Manages account groups, chart of accounts, journal entries, general ledger,
// trial balance, profit & loss, and balance sheet.
// Used by: /api/accounting routes
// =============================================================

const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

// ============== ACCOUNT GROUPS ==============

exports.getAccountGroups = async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM account_groups';
    const params = [];
    if (type) { sql += ' WHERE group_type = ?'; params.push(type); }
    sql += ' ORDER BY group_type, group_name';

    const groups = await query(sql, params);
    res.json({ data: groups });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== CHART OF ACCOUNTS ==============

exports.getAccounts = async (req, res) => {
  try {
    const { type, search, tree } = req.query;

    // Tree mode: return all accounts flat, sorted for tree building
    if (tree === '1' || tree === 'true') {
      let sql = `SELECT a.account_id, a.account_code, a.account_name, a.account_type,
                   a.parent_account_id, a.level, a.is_system, a.is_active,
                   a.opening_balance, a.current_balance, a.description,
                   g.group_name
                 FROM accounts a
                 JOIN account_groups g ON a.group_id = g.group_id
                 WHERE 1=1`;
      const params = [];
      if (type) { sql += ' AND a.account_type = ?'; params.push(type); }
      if (search) {
        sql += ' AND (a.account_code LIKE ? OR a.account_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ' ORDER BY a.level ASC, a.account_code ASC';
      const accounts = await query(sql, params);
      return res.json({ data: accounts });
    }

    // Paginated mode (legacy)
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);
    let sql = `SELECT a.*, g.group_name, g.group_type,
               (SELECT account_name FROM accounts WHERE account_id = a.parent_account_id) as parent_account_name
               FROM accounts a
               JOIN account_groups g ON a.group_id = g.group_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM accounts WHERE 1=1';
    const params = [], countParams = [];

    if (type) { sql += ' AND a.account_type = ?'; countSql += ' AND account_type = ?'; params.push(type); countParams.push(type); }
    if (search) {
      const pattern = `%${search}%`;
      sql += ' AND (a.account_code LIKE ? OR a.account_name LIKE ?)';
      countSql += ' AND (account_code LIKE ? OR account_name LIKE ?)';
      params.push(pattern, pattern); countParams.push(pattern, pattern);
    }
    sql += ' ORDER BY a.account_code LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [accounts, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: accounts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /accounting/accounts/next-code?parent_id=X
exports.getNextCode = async (req, res) => {
  try {
    const { parent_id } = req.query;
    if (!parent_id) return res.status(400).json({ message: 'parent_id is required' });

    const parents = await query('SELECT * FROM accounts WHERE account_id = ?', [parent_id]);
    if (parents.length === 0) return res.status(404).json({ message: 'Parent not found' });
    const parent = parents[0];

    const childLevel = parent.level + 1;
    if (childLevel > 4) return res.status(400).json({ message: 'Max 4 levels allowed' });

    // Get existing sibling codes under this parent
    const siblings = await query(
      'SELECT account_code FROM accounts WHERE parent_account_id = ? ORDER BY account_code',
      [parent_id]
    );

    // Dash-pattern: L2=1-01, L3=1-01-001, L4=1-01-001-001
    const pad = childLevel === 2 ? 2 : 3;
    let maxSeq = 0;
    if (siblings.length > 0) {
      maxSeq = Math.max(...siblings.map(s => {
        const parts = s.account_code.split('-');
        return parseInt(parts[parts.length - 1]) || 0;
      }));
    }
    const nextCode = parent.account_code + '-' + String(maxSeq + 1).padStart(pad, '0');

    res.json({ next_code: nextCode, parent_code: parent.account_code, child_level: childLevel });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const [account] = await query(`
      SELECT a.*, g.group_name, g.group_type,
      (SELECT account_name FROM accounts WHERE account_id = a.parent_account_id) as parent_account_name
      FROM accounts a
      JOIN account_groups g ON a.group_id = g.group_id
      WHERE a.account_id = ?
    `, [req.params.id]);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const { account_code, account_name, parent_account_id, opening_balance, description } = req.body;

    if (!account_code || !account_name) {
      return res.status(400).json({ message: 'Account code and name are required' });
    }
    if (!parent_account_id) {
      return res.status(400).json({ message: 'Parent account is required' });
    }

    // Fetch parent to inherit type, group, and compute level
    const parents = await query('SELECT * FROM accounts WHERE account_id = ?', [parent_account_id]);
    if (parents.length === 0) return res.status(400).json({ message: 'Parent account not found' });
    const parent = parents[0];

    const level = parent.level + 1;
    if (level > 4) return res.status(400).json({ message: 'Maximum 4 levels of accounts allowed' });

    const result = await query(
      `INSERT INTO accounts (account_code, account_name, group_id, parent_account_id, account_type, level, is_system, opening_balance, current_balance, description)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [account_code, account_name, parent.group_id, parent_account_id, parent.account_type,
       level, opening_balance || 0, opening_balance || 0, description || null]
    );

    await logAction(req.user.user_id, req.user.name, 'ACCOUNT_CREATED', 'accounts', result.insertId,
      { account_code, account_name, parent: parent.account_name, level }, req.ip);
    res.status(201).json({ message: 'Account created', account_id: result.insertId });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Account code already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { account_name, is_active, description } = req.body;

    const existing = await query('SELECT * FROM accounts WHERE account_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Account not found' });
    if (existing[0].is_system) return res.status(400).json({ message: 'System accounts cannot be edited' });

    if (!account_name) return res.status(400).json({ message: 'Account name is required' });

    // Only update is_active when explicitly provided — omitting it must not silently re-activate (B-016)
    const activeVal = 'is_active' in req.body ? (is_active ?? 1) : existing[0].is_active;
    await query(
      'UPDATE accounts SET account_name=?, is_active=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE account_id=?',
      [account_name, activeVal, description || null, id]
    );

    await logAction(req.user.user_id, req.user.name, 'ACCOUNT_UPDATED', 'accounts', id, { account_name }, req.ip);
    res.json({ message: 'Account updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM accounts WHERE account_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Account not found' });
    if (existing[0].is_system) return res.status(400).json({ message: 'System accounts cannot be deleted' });

    // Block if has sub-accounts
    const [{ children }] = await query('SELECT COUNT(*) as children FROM accounts WHERE parent_account_id = ?', [id]);
    if (children > 0) return res.status(400).json({ message: 'Cannot delete account that has sub-accounts' });

    // Block if has transactions
    const [{ txns }] = await query('SELECT COUNT(*) as txns FROM journal_entry_lines WHERE account_id = ?', [id]);
    if (txns > 0) return res.status(400).json({ message: 'Cannot delete account with existing transactions' });

    await query('DELETE FROM accounts WHERE account_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'ACCOUNT_DELETED', 'accounts', id, {}, req.ip);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== JOURNAL ENTRIES ==============

exports.getJournalEntries = async (req, res) => {
  try {
    const { from_date, to_date, status } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT je.*, u.name as created_by_name FROM journal_entries je
               JOIN users u ON je.created_by = u.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM journal_entries WHERE 1=1';
    const params = [], countParams = [];

    if (from_date && to_date) {
      sql += ' AND je.entry_date BETWEEN ? AND ?';
      countSql += ' AND entry_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }
    if (status) { sql += ' AND je.status = ?'; countSql += ' AND status = ?'; params.push(status); countParams.push(status); }

    sql += ' ORDER BY je.entry_date DESC, je.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [entries, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: entries, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getJournalEntryById = async (req, res) => {
  try {
    const [entry] = await query(`
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      JOIN users u ON je.created_by = u.user_id
      WHERE je.entry_id = ?
    `, [req.params.id]);

    if (!entry) return res.status(404).json({ message: 'Journal entry not found' });

    const lines = await query(`
      SELECT jel.*, a.account_code, a.account_name
      FROM journal_entry_lines jel
      JOIN accounts a ON jel.account_id = a.account_id
      WHERE jel.entry_id = ?
      ORDER BY jel.line_id
    `, [req.params.id]);

    res.json({ ...entry, lines });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createJournalEntry = async (req, res) => {
  const conn = await getConnection();
  try {
    const { entry_date, description, lines } = req.body;

    if (!entry_date || !lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ message: 'Entry date and at least 2 lines required' });
    }

    // Validate debits = credits
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ message: 'Total debits must equal total credits', field: 'lines' });
    }

    // Validate all accounts are Level 4
    const accountIds = lines.filter(l => l.account_id).map(l => l.account_id);
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      const accs = await conn.query(`SELECT account_id, account_name, is_active FROM accounts WHERE account_id IN (${placeholders})`, accountIds);
      const inactive = accs.filter(a => !a.is_active);
      if (inactive.length > 0) {
        return res.status(400).json({ message: `Inactive accounts cannot be used: ${inactive.map(a => a.account_name).join(', ')}` });
      }
    }

    await conn.beginTransaction();

    // Generate entry number
    const [lastEntry] = await conn.query('SELECT entry_number FROM journal_entries ORDER BY entry_id DESC LIMIT 1');
    let nextNumber = 1;
    if (lastEntry && lastEntry.entry_number) {
      const match = lastEntry.entry_number.match(/JV(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const entryNumber = `JV${String(nextNumber).padStart(6, '0')}`;

    // Create journal entry
    const result = await conn.query(
      'INSERT INTO journal_entries (entry_number, entry_date, description, total_debit, total_credit, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [entryNumber, entry_date, description || null, totalDebit, totalCredit, req.user.user_id]
    );

    const entryId = result.insertId;

    // Create lines
    for (const line of lines) {
      if (!line.account_id || (Number(line.debit || 0) === 0 && Number(line.credit || 0) === 0)) continue;

      await conn.query(
        'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, ?)',
        [entryId, line.account_id, line.description || null, line.debit || 0, line.credit || 0]
      );
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'JOURNAL_ENTRY_CREATED', 'journal_entries', entryId, { entry_number: entryNumber }, req.ip);
    res.status(201).json({ message: 'Journal entry created', entry_id: entryId, entry_number: entryNumber });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.postJournalEntry = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [entry] = await conn.query('SELECT * FROM journal_entries WHERE entry_id = ? FOR UPDATE', [id]);
    if (!entry) { await conn.rollback(); return res.status(404).json({ message: 'Entry not found' }); }
    if (entry.status !== 'draft') { await conn.rollback(); return res.status(400).json({ message: 'Only draft entries can be posted' }); }

    // Get all lines
    const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [id]);

    // Update account balances in a single batch query (avoids N+1)
    const accountIds = [...new Set(lines.map(l => l.account_id))];
    const accountRows = await conn.query(
      `SELECT account_id, account_type FROM accounts WHERE account_id IN (${accountIds.map(() => '?').join(',')})`,
      accountIds
    );
    const accountTypeMap = {};
    for (const acc of accountRows) accountTypeMap[acc.account_id] = acc.account_type;

    const caseWhenParts = lines.map(() => 'WHEN ? THEN current_balance + ?').join(' ');
    const caseParams = [];
    for (const line of lines) {
      const debitIncrease = ['asset', 'expense'].includes(accountTypeMap[line.account_id]);
      const change = debitIncrease
        ? (Number(line.debit) - Number(line.credit))
        : (Number(line.credit) - Number(line.debit));
      caseParams.push(line.account_id, change);
    }
    await conn.query(
      `UPDATE accounts SET current_balance = CASE account_id ${caseWhenParts} END WHERE account_id IN (${accountIds.map(() => '?').join(',')})`,
      [...caseParams, ...accountIds]
    );

    // Mark entry as posted
    await conn.query('UPDATE journal_entries SET status = ?, posted_at = CURRENT_TIMESTAMP WHERE entry_id = ?', ['posted', id]);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'JOURNAL_ENTRY_POSTED', 'journal_entries', id, { entry_number: entry.entry_number }, req.ip);
    res.json({ message: 'Journal entry posted successfully' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deleteJournalEntry = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const [entry] = await query('SELECT * FROM journal_entries WHERE entry_id = ?', [id]);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    await conn.beginTransaction();

    // If posted, reverse account balance changes before deleting
    if (entry.status === 'posted') {
      const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [id]);
      if (lines.length > 0) {
        const accountIds = [...new Set(lines.map(l => l.account_id))];
        const accountRows = await conn.query(
          `SELECT account_id, account_type FROM accounts WHERE account_id IN (${accountIds.map(() => '?').join(',')})`,
          accountIds
        );
        const typeMap = {};
        for (const acc of accountRows) typeMap[acc.account_id] = acc.account_type;

        // Reverse: opposite sign of what postJournalEntry applied
        const caseWhenParts = lines.map(() => 'WHEN ? THEN current_balance + ?').join(' ');
        const caseParams = [];
        for (const line of lines) {
          const debitIncrease = ['asset', 'expense'].includes(typeMap[line.account_id]);
          const reversal = debitIncrease
            ? -(Number(line.debit) - Number(line.credit))
            : -(Number(line.credit) - Number(line.debit));
          caseParams.push(line.account_id, reversal);
        }
        await conn.query(
          `UPDATE accounts SET current_balance = CASE account_id ${caseWhenParts} END WHERE account_id IN (${accountIds.map(() => '?').join(',')})`,
          [...caseParams, ...accountIds]
        );
      }
    }

    await conn.query('DELETE FROM journal_entry_lines WHERE entry_id = ?', [id]);
    await conn.query('DELETE FROM journal_entries WHERE entry_id = ?', [id]);
    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'JOURNAL_ENTRY_DELETED', 'journal_entries', id,
      { entry_number: entry.entry_number, was_posted: entry.status === 'posted' }, req.ip);
    res.json({ message: 'Journal entry deleted' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== GENERAL LEDGER ==============

exports.getGeneralLedger = async (req, res) => {
  try {
    const { account_id, from_date, to_date } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    if (!account_id) {
      return res.json({ data: [], pagination: { total: 0, page, limit, totalPages: 0 }, opening_balance: 0, account: null });
    }

    const dateFilter = from_date && to_date;

    // UNION: JV lines + non-journalized CPV/CRV on account_id side
    const unionSql = `
      SELECT jel.line_id AS tx_id, je.entry_number AS ref_number, je.entry_date AS tx_date,
             COALESCE(jel.description, je.description) AS description,
             jel.debit, jel.credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.entry_id
      WHERE je.status = 'posted' AND jel.account_id = ?
      ${dateFilter ? 'AND je.entry_date BETWEEN ? AND ?' : ''}

      UNION ALL

      SELECT pv.voucher_id, pv.voucher_number, pv.voucher_date,
             COALESCE(pv.description, pv.payment_to),
             pv.amount AS debit, 0 AS credit
      FROM payment_vouchers pv
      WHERE pv.account_id = ? AND pv.journal_entry_id IS NULL
      ${dateFilter ? 'AND pv.voucher_date BETWEEN ? AND ?' : ''}

      UNION ALL

      SELECT rv.voucher_id, rv.voucher_number, rv.voucher_date,
             COALESCE(rv.description, rv.received_from),
             0 AS debit, rv.amount AS credit
      FROM receipt_vouchers rv
      WHERE rv.account_id = ? AND rv.journal_entry_id IS NULL
      ${dateFilter ? 'AND rv.voucher_date BETWEEN ? AND ?' : ''}
    `;

    const buildParams = () => {
      const p = [account_id];
      if (dateFilter) p.push(from_date, to_date);
      p.push(account_id);
      if (dateFilter) p.push(from_date, to_date);
      p.push(account_id);
      if (dateFilter) p.push(from_date, to_date);
      return p;
    };

    const countSql = `SELECT COUNT(*) as total FROM (${unionSql}) AS combined`;
    const pageSql  = `SELECT * FROM (${unionSql}) AS combined ORDER BY tx_date ASC, tx_id ASC LIMIT ? OFFSET ?`;

    const pageParams  = [...buildParams(), limit, offset];
    const countParams = buildParams();

    const [ledger, [{ total }]] = await Promise.all([query(pageSql, pageParams), query(countSql, countParams)]);

    // Account info
    const accs = await query(
      'SELECT account_id, account_code, account_name, account_type, opening_balance FROM accounts WHERE account_id = ?',
      [account_id]
    );
    let openingBalance = 0;
    let accountInfo = null;
    if (accs.length > 0) {
      accountInfo = accs[0];
      openingBalance = Number(accs[0].opening_balance || 0);

      if (from_date) {
        // JV contribution before from_date
        const [jvPrev] = await query(`
          SELECT COALESCE(SUM(jel.debit),0) AS dr, COALESCE(SUM(jel.credit),0) AS cr
          FROM journal_entry_lines jel
          JOIN journal_entries je ON jel.entry_id = je.entry_id
          WHERE jel.account_id = ? AND je.status = 'posted' AND je.entry_date < ?
        `, [account_id, from_date]);
        // CPV contribution before from_date
        const [cpvPrev] = await query(`
          SELECT COALESCE(SUM(amount),0) AS dr
          FROM payment_vouchers WHERE account_id = ? AND journal_entry_id IS NULL AND voucher_date < ?
        `, [account_id, from_date]);
        // CRV contribution before from_date
        const [crvPrev] = await query(`
          SELECT COALESCE(SUM(amount),0) AS cr
          FROM receipt_vouchers WHERE account_id = ? AND journal_entry_id IS NULL AND voucher_date < ?
        `, [account_id, from_date]);

        const debitIncrease = ['asset', 'expense'].includes(accs[0].account_type);
        const prevDr = Number(jvPrev.dr || 0) + Number(cpvPrev.dr || 0);
        const prevCr = Number(jvPrev.cr || 0) + Number(crvPrev.cr || 0);
        openingBalance += debitIncrease ? (prevDr - prevCr) : (prevCr - prevDr);
      }
    }

    // Map column names to what frontend expects
    const data = ledger.map((r) => ({
      line_id: r.tx_id,
      entry_number: r.ref_number,
      entry_date: r.tx_date,
      description: r.description,
      debit: r.debit,
      credit: r.credit,
    }));

    res.json({
      data,
      pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) },
      opening_balance: openingBalance,
      account: accountInfo
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== REPORTS ==============

exports.getTrialBalance = async (req, res) => {
  try {
    const { as_of_date } = req.query;
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0];

    const accounts = await query(`
      SELECT a.account_id, a.account_code, a.account_name, a.account_type, a.opening_balance,
             COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jel.debit ELSE 0 END), 0) as total_debit,
             COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jel.credit ELSE 0 END), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id AND je.status = 'posted'
      WHERE a.is_active = 1
      GROUP BY a.account_id
      ORDER BY a.account_code
    `, [asOfDate, asOfDate]);

    const trial = accounts.map(a => {
      const opening = Number(a.opening_balance || 0);
      const debit = Number(a.total_debit || 0);
      const credit = Number(a.total_credit || 0);
      const debitIncrease = ['asset', 'expense'].includes(a.account_type);

      const closingBalance = opening + (debitIncrease ? (debit - credit) : (credit - debit));

      return {
        account_id: a.account_id,
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        debit: closingBalance > 0 ? Math.abs(closingBalance) : 0,
        credit: closingBalance < 0 ? Math.abs(closingBalance) : 0
      };
    });

    const totals = trial.reduce((acc, t) => ({
      total_debit: acc.total_debit + t.debit,
      total_credit: acc.total_credit + t.credit
    }), { total_debit: 0, total_credit: 0 });

    res.json({ as_of_date: asOfDate, trial_balance: trial, totals });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTrialBalance6Col = async (req, res) => {
  try {
    const { from_date, to_date, parent_account_id } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ message: 'from_date and to_date are required' });

    // Build list of account IDs to include (all descendants of parent, or all accounts)
    let accountIdFilter = '';
    let filterParams = [];
    if (parent_account_id) {
      // Recursively collect all descendant IDs in JS (avoids CTE version issues)
      const allAccs = await query('SELECT account_id, parent_account_id FROM accounts WHERE is_active = 1');
      const childMap = {};
      for (const a of allAccs) {
        if (!childMap[a.parent_account_id]) childMap[a.parent_account_id] = [];
        childMap[a.parent_account_id].push(Number(a.account_id));
      }
      const ids = [];
      const queue = [Number(parent_account_id)];
      while (queue.length > 0) {
        const id = queue.shift();
        ids.push(id);
        for (const child of (childMap[id] || [])) queue.push(child);
      }
      accountIdFilter = `AND a.account_id IN (${ids.map(() => '?').join(',')})`;
      filterParams = ids;
    }

    const accounts = await query(`
      SELECT a.account_id, a.parent_account_id, a.level, a.account_code, a.account_name, a.account_type, a.opening_balance,
             COALESCE(SUM(CASE WHEN je.entry_date < ? THEN jel.debit  ELSE 0 END), 0) as ob_debit,
             COALESCE(SUM(CASE WHEN je.entry_date < ? THEN jel.credit ELSE 0 END), 0) as ob_credit,
             COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? THEN jel.debit  ELSE 0 END), 0) as period_debit,
             COALESCE(SUM(CASE WHEN je.entry_date BETWEEN ? AND ? THEN jel.credit ELSE 0 END), 0) as period_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id AND je.status = 'posted'
      WHERE a.is_active = 1 ${accountIdFilter}
      GROUP BY a.account_id
      ORDER BY a.account_code
    `, [from_date, from_date, from_date, to_date, from_date, to_date, ...filterParams]);

    const rows = accounts.map(a => {
      const debitIncrease = ['asset', 'expense'].includes(a.account_type);
      const obBase = Number(a.opening_balance || 0);
      const obDr = Number(a.ob_debit || 0);
      const obCr = Number(a.ob_credit || 0);

      // Unified signed balance: positive = Dr, negative = Cr
      // Asset/expense base is Dr-normal (+obBase); liability/equity/revenue base is Cr-normal (-obBase)
      const openingSigned = (debitIncrease ? obBase : -obBase) + (obDr - obCr);

      const periodDr = Number(a.period_debit || 0);
      const periodCr = Number(a.period_credit || 0);

      const closingSigned = openingSigned + (periodDr - periodCr);

      return {
        account_id:        Number(a.account_id),
        parent_account_id: a.parent_account_id ? Number(a.parent_account_id) : null,
        level:             Number(a.level || 1),
        account_code:      a.account_code,
        account_name:      a.account_name,
        account_type:      a.account_type,
        opening_dr:        openingSigned > 0 ? openingSigned : 0,
        opening_cr:        openingSigned < 0 ? -openingSigned : 0,
        period_dr:         periodDr,
        period_cr:         periodCr,
        closing_dr:        closingSigned > 0 ? closingSigned : 0,
        closing_cr:        closingSigned < 0 ? -closingSigned : 0,
      };
    });

    // Totals from leaf accounts only (accounts with no children in result) to avoid double-counting
    const accountIdsInResult = new Set(rows.map(r => r.account_id));
    const parentIdsInResult  = new Set(rows.map(r => r.parent_account_id).filter(id => id !== null && accountIdsInResult.has(id)));
    const leafRows = rows.filter(r => !parentIdsInResult.has(r.account_id));

    const totals = leafRows.reduce((acc, r) => ({
      opening_dr:  acc.opening_dr  + r.opening_dr,
      opening_cr:  acc.opening_cr  + r.opening_cr,
      period_dr:   acc.period_dr   + r.period_dr,
      period_cr:   acc.period_cr   + r.period_cr,
      closing_dr:  acc.closing_dr  + r.closing_dr,
      closing_cr:  acc.closing_cr  + r.closing_cr,
    }), { opening_dr: 0, opening_cr: 0, period_dr: 0, period_cr: 0, closing_dr: 0, closing_cr: 0 });

    // Sort rows in depth-first tree order so parents appear directly before their children
    const byParent = new Map();
    const roots = [];
    for (const row of rows) {
      if (row.parent_account_id === null) {
        roots.push(row);
      } else {
        if (!byParent.has(row.parent_account_id)) byParent.set(row.parent_account_id, []);
        byParent.get(row.parent_account_id).push(row);
      }
    }
    const sortedRows = [];
    const visit = (node) => {
      sortedRows.push(node);
      const children = (byParent.get(node.account_id) || [])
        .sort((a, b) => a.account_code.localeCompare(b.account_code));
      children.forEach(visit);
    };
    roots.sort((a, b) => a.account_code.localeCompare(b.account_code));
    roots.forEach(visit);

    res.json({ from_date, to_date, data: sortedRows, totals });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ message: 'Date range required' });

    // Aggregate from journal entries + CPV (expense debits) + CRV (revenue credits)
    // All amounts use credit-debit convention:
    //   revenue: credit > debit → positive
    //   expense: debit > credit → negative (frontend uses Math.abs)
    const accounts = await query(`
      SELECT a.account_id, a.account_code, a.account_name, a.account_type, g.group_name,
             COALESCE(SUM(txn.net_amount), 0) AS amount
      FROM accounts a
      JOIN account_groups g ON a.group_id = g.group_id
      JOIN (
        SELECT jel.account_id, (jel.credit - jel.debit) AS net_amount
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.entry_id = je.entry_id
        WHERE je.status = 'posted' AND je.entry_date BETWEEN ? AND ?

        UNION ALL

        SELECT rv.account_id, rv.amount AS net_amount
        FROM receipt_vouchers rv
        WHERE rv.journal_entry_id IS NULL AND rv.voucher_date BETWEEN ? AND ?

        UNION ALL

        SELECT pv.account_id, -pv.amount AS net_amount
        FROM payment_vouchers pv
        WHERE pv.journal_entry_id IS NULL AND pv.voucher_date BETWEEN ? AND ?
      ) txn ON a.account_id = txn.account_id
      WHERE a.account_type IN ('revenue', 'expense') AND a.is_active = 1
      GROUP BY a.account_id
      HAVING ABS(SUM(txn.net_amount)) > 0.001
      ORDER BY a.account_type, a.account_code
    `, [from_date, to_date, from_date, to_date, from_date, to_date]);

    const revenue  = accounts.filter(a => a.account_type === 'revenue').map(a => ({ ...a, amount: Number(a.amount) }));
    const expenses = accounts.filter(a => a.account_type === 'expense').map(a => ({ ...a, amount: Math.abs(Number(a.amount)) }));

    const total_revenue  = revenue.reduce((s, r) => s + r.amount, 0);
    const total_expenses = expenses.reduce((s, e) => s + e.amount, 0);
    const net_profit     = total_revenue - total_expenses;

    res.json({ revenue, expenses, total_revenue, total_expenses, net_profit, period: { from_date, to_date } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBalanceSheet = async (req, res) => {
  try {
    const { as_of_date } = req.query;
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0];

    // 1. Fetch all BS accounts with hierarchy and net movement up to as_of_date
    const rows = await query(`
      SELECT
        a.account_id, a.account_code, a.account_name, a.account_type,
        a.parent_account_id, a.level, a.is_system,
        COALESCE(a.opening_balance, 0) as opening_balance,
        COALESCE(SUM(CASE WHEN je.entry_date <= ? AND je.status = 'posted'
                     THEN jel.debit - jel.credit ELSE 0 END), 0) as net_change
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id
      WHERE a.account_type IN ('asset', 'liability', 'equity') AND a.is_active = 1
      GROUP BY a.account_id
      ORDER BY a.account_code
    `, [asOfDate]);

    // 2. Calculate Net Profit/Loss (Revenue - Expenses) up to as_of_date for Retained Earnings
    const plRows = await query(`
      SELECT
        a.account_type,
        COALESCE(a.opening_balance, 0) as opening_balance,
        COALESCE(SUM(CASE WHEN je.entry_date <= ? AND je.status = 'posted'
                     THEN jel.debit - jel.credit ELSE 0 END), 0) as net_change
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id
      WHERE a.account_type IN ('revenue', 'expense') AND a.is_active = 1
      GROUP BY a.account_id
    `, [asOfDate]);

    let totalRevenue = 0, totalExpense = 0;
    for (const r of plRows) {
      const opening = Number(r.opening_balance || 0);
      const change  = Number(r.net_change || 0);
      if (r.account_type === 'revenue') {
        // Revenue: credit increases → balance = opening - net_change (debit-credit)
        totalRevenue += opening - change;
      } else {
        // Expense: debit increases → balance = opening + net_change
        totalExpense += opening + change;
      }
    }
    const netProfit = totalRevenue - totalExpense;

    // 3. Build node map with computed balances
    const nodeMap = {};
    for (const r of rows) {
      const opening = Number(r.opening_balance || 0);
      const change  = Number(r.net_change || 0);
      // Asset: debit-normal → balance = opening + net_change
      // Liability/Equity: credit-normal → balance = opening - net_change
      const balance = r.account_type === 'asset' ? (opening + change) : (opening - change);
      nodeMap[r.account_id] = {
        account_id:        Number(r.account_id),
        account_code:      r.account_code,
        account_name:      r.account_name,
        account_type:      r.account_type,
        parent_account_id: r.parent_account_id ? Number(r.parent_account_id) : null,
        level:             Number(r.level || 1),
        is_system:         Number(r.is_system || 0),
        balance,
        children: []
      };
    }

    // 4. Link children to parents; collect roots by section
    const roots = { asset: [], liability: [], equity: [] };
    for (const node of Object.values(nodeMap)) {
      const pid = node.parent_account_id;
      if (pid && nodeMap[pid]) {
        nodeMap[pid].children.push(node);
      } else {
        if (roots[node.account_type]) roots[node.account_type].push(node);
      }
    }

    // Sort children by account_code
    const sortChildren = (node) => {
      node.children.sort((a, b) => a.account_code.localeCompare(b.account_code));
      node.children.forEach(sortChildren);
    };
    [...roots.asset, ...roots.liability, ...roots.equity].forEach(sortChildren);

    // 5. Bubble-up balances: parent = sum of children (if any children exist)
    function bubbleUp(node) {
      if (node.children.length > 0) {
        node.children.forEach(bubbleUp);
        node.balance = node.children.reduce((s, c) => s + c.balance, 0);
      }
    }
    [...roots.asset, ...roots.liability, ...roots.equity].forEach(bubbleUp);

    const totalAssets      = roots.asset.reduce((s, n) => s + n.balance, 0);
    const totalLiabilities = roots.liability.reduce((s, n) => s + n.balance, 0);
    const totalEquity      = roots.equity.reduce((s, n) => s + n.balance, 0);

    res.json({
      as_of_date:              asOfDate,
      assets:                  roots.asset,
      liabilities:             roots.liability,
      equity:                  roots.equity,
      net_profit:              netProfit,
      total_assets:            totalAssets,
      total_liabilities:       totalLiabilities,
      total_equity:            totalEquity + netProfit,
      total_liabilities_equity: totalLiabilities + totalEquity + netProfit
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== BANK ACCOUNTS ==============

exports.getBankAccounts = async (req, res) => {
  try {
    const { is_active } = req.query;
    let sql = `SELECT ba.*, a.account_code, a.account_name
               FROM bank_accounts ba
               JOIN accounts a ON ba.account_id = a.account_id WHERE 1=1`;
    const params = [];
    if (is_active !== undefined) { sql += ' AND ba.is_active = ?'; params.push(is_active); }
    sql += ' ORDER BY ba.bank_name';

    const accounts = await query(sql, params);
    res.json({ data: accounts });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBankAccountById = async (req, res) => {
  try {
    const [account] = await query(`
      SELECT ba.*, a.account_code, a.account_name
      FROM bank_accounts ba
      JOIN accounts a ON ba.account_id = a.account_id
      WHERE ba.bank_account_id = ?
    `, [req.params.id]);
    if (!account) return res.status(404).json({ message: 'Bank account not found' });
    res.json(account);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createBankAccount = async (req, res) => {
  try {
    const { account_id, bank_name, account_number, account_holder, branch, ifsc_code, opening_balance } = req.body;
    if (!account_id || !bank_name || !account_number) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const result = await query(
      'INSERT INTO bank_accounts (account_id, bank_name, account_number, account_holder, branch, ifsc_code, opening_balance, current_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [account_id, bank_name, account_number, account_holder || null, branch || null, ifsc_code || null, opening_balance || 0, opening_balance || 0]
    );

    await logAction(req.user.user_id, req.user.name, 'BANK_ACCOUNT_CREATED', 'bank_accounts', result.insertId, { bank_name, account_number }, req.ip);
    res.status(201).json({ message: 'Bank account created', bank_account_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { bank_name, account_number, account_holder, branch, ifsc_code, is_active } = req.body;
    if (!bank_name || !account_number) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await query(
      'UPDATE bank_accounts SET bank_name=?, account_number=?, account_holder=?, branch=?, ifsc_code=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE bank_account_id=?',
      [bank_name, account_number, account_holder || null, branch || null, ifsc_code || null, is_active ?? 1, id]
    );

    await logAction(req.user.user_id, req.user.name, 'BANK_ACCOUNT_UPDATED', 'bank_accounts', id, { bank_name }, req.ip);
    res.json({ message: 'Bank account updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM bank_accounts WHERE bank_account_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'BANK_ACCOUNT_DELETED', 'bank_accounts', id, {}, req.ip);
    res.json({ message: 'Bank account deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== PAYMENT VOUCHERS ==============

exports.getPaymentVouchers = async (req, res) => {
  try {
    const { from_date, to_date, payment_type } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT
                 pv.voucher_number,
                 pv.voucher_date,
                 MAX(pv.main_account_id) as main_account_id,
                 MAX(ma.account_name) as main_account_name,
                 MAX(pv.description) as description,
                 SUM(pv.amount) as total_amount,
                 COUNT(*) as line_count,
                 MIN(u.name) as created_by_name,
                 MIN(pv.created_at) as created_at
               FROM payment_vouchers pv
               JOIN users u ON pv.created_by = u.user_id
               LEFT JOIN accounts ma ON pv.main_account_id = ma.account_id
               WHERE 1=1`;
    let countSql = 'SELECT COUNT(DISTINCT voucher_number) as total FROM payment_vouchers WHERE 1=1';
    const params = [], countParams = [];

    if (from_date && to_date) {
      sql += ' AND pv.voucher_date BETWEEN ? AND ?';
      countSql += ' AND voucher_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }
    if (payment_type) { sql += ' AND pv.payment_type = ?'; countSql += ' AND payment_type = ?'; params.push(payment_type); countParams.push(payment_type); }

    sql += ' GROUP BY pv.voucher_number, pv.voucher_date ORDER BY pv.voucher_date DESC, MIN(pv.created_at) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [vouchers, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: vouchers, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getNextPaymentVoucherNumber = async (req, res) => {
  try {
    const [maxRow] = await query("SELECT MAX(CAST(SUBSTRING(voucher_number, 4) AS UNSIGNED)) as max_num FROM payment_vouchers WHERE voucher_number REGEXP '^CPV[0-9]+'");
    const nextNumber = (maxRow?.max_num || 0) + 1;
    res.json({ voucher_number: `CPV${String(nextNumber).padStart(6, '0')}` });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

exports.createPaymentVoucher = async (req, res) => {
  const conn = await getConnection();
  try {
    const { voucher_number, voucher_date, payment_to, payment_type, account_id, main_account_id, amount, payment_method, cheque_number, bank_account_id, description } = req.body;

    if (!voucher_date || !payment_to || !account_id || !amount) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const [acc] = await conn.query('SELECT account_id, account_name, account_type, is_active FROM accounts WHERE account_id = ?', [account_id]);
    if (!acc)           return res.status(400).json({ message: 'Account not found' });
    if (!acc.is_active) return res.status(400).json({ message: `Account "${acc.account_name}" is inactive` });

    await conn.beginTransaction();

    let voucherNumber = voucher_number;
    if (!voucherNumber) {
      const [maxRow] = await conn.query("SELECT MAX(CAST(SUBSTRING(voucher_number, 4) AS UNSIGNED)) as max_num FROM payment_vouchers WHERE voucher_number REGEXP '^CPV[0-9]+'");
      const nextNumber = (maxRow?.max_num || 0) + 1;
      voucherNumber = `CPV${String(nextNumber).padStart(6, '0')}`;
    }

    // CPV: line account gets debited (expense increases)
    const debitIncrease = ['asset', 'expense'].includes(acc.account_type);
    await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [debitIncrease ? amount : -amount, account_id]);

    // CPV: main account (cash/bank) gets credited — cash going out
    if (main_account_id) {
      const [mainAcc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [main_account_id]);
      if (mainAcc) {
        const mainDebitInc = ['asset', 'expense'].includes(mainAcc.account_type);
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [mainDebitInc ? -amount : amount, main_account_id]);
      }
    }

    const result = await conn.query(
      'INSERT INTO payment_vouchers (voucher_number, voucher_date, payment_to, payment_type, account_id, main_account_id, amount, payment_method, cheque_number, bank_account_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [voucherNumber, voucher_date, payment_to, payment_type || 'expense', account_id, main_account_id || null, amount, payment_method || 'cash', cheque_number || null, bank_account_id || null, description || null, req.user.user_id]
    );

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PAYMENT_VOUCHER_CREATED', 'payment_vouchers', result.insertId, { voucher_number: voucherNumber, amount }, req.ip);
    res.status(201).json({ message: 'Payment voucher created', voucher_id: result.insertId, voucher_number: voucherNumber });
  } catch (err) {
    await conn.rollback();
    logger.error('createPaymentVoucher error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deletePaymentVoucher = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const [voucher] = await conn.query('SELECT * FROM payment_vouchers WHERE voucher_id = ?', [id]);
    if (!voucher) return res.status(404).json({ message: 'Voucher not found' });

    await conn.beginTransaction();

    if (voucher.journal_entry_id) {
      // Voucher was created with old double-entry — reverse JE balances
      const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
      const [je] = await conn.query('SELECT status FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
      if (je && je.status === 'posted' && lines.length > 0) {
        const accIds = [...new Set(lines.map(l => l.account_id))];
        const accRows = await conn.query(`SELECT account_id, account_type FROM accounts WHERE account_id IN (${accIds.map(() => '?').join(',')})`, accIds);
        const typeMap = {};
        for (const a of accRows) typeMap[a.account_id] = a.account_type;
        for (const line of lines) {
          const debitInc = ['asset', 'expense'].includes(typeMap[line.account_id]);
          const reversal = debitInc ? -(Number(line.debit) - Number(line.credit)) : -(Number(line.credit) - Number(line.debit));
          await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [reversal, line.account_id]);
        }
      }
      // NULL out FK before deleting JE (avoids constraint error)
      await conn.query('UPDATE payment_vouchers SET journal_entry_id = NULL WHERE voucher_id = ?', [id]);
      await conn.query('DELETE FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
      await conn.query('DELETE FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
    } else {
      // Reverse direct balance update for line account
      const [acc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.account_id]);
      if (acc) {
        const debitInc = ['asset', 'expense'].includes(acc.account_type);
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [debitInc ? -Number(voucher.amount) : Number(voucher.amount), voucher.account_id]);
      }
      // Reverse main account balance (re-credit the cash that was credited)
      if (voucher.main_account_id) {
        const [mainAcc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.main_account_id]);
        if (mainAcc) {
          const mainDebitInc = ['asset', 'expense'].includes(mainAcc.account_type);
          await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [mainDebitInc ? Number(voucher.amount) : -Number(voucher.amount), voucher.main_account_id]);
        }
      }
    }

    await conn.query('DELETE FROM payment_vouchers WHERE voucher_id = ?', [id]);
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PAYMENT_VOUCHER_DELETED', 'payment_vouchers', id, {}, req.ip);
    res.json({ message: 'Payment voucher deleted' });
  } catch (err) {
    await conn.rollback();
    logger.error('deletePaymentVoucher error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.getPaymentVoucherLines = async (req, res) => {
  try {
    const { voucher_number } = req.params;
    const rows = await query(
      `SELECT pv.*, a.account_name FROM payment_vouchers pv
       JOIN accounts a ON pv.account_id = a.account_id
       WHERE pv.voucher_number = ? ORDER BY pv.created_at ASC`,
      [voucher_number]
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getReceiptVoucherLines = async (req, res) => {
  try {
    const { voucher_number } = req.params;
    const rows = await query(
      `SELECT rv.*, a.account_name FROM receipt_vouchers rv
       JOIN accounts a ON rv.account_id = a.account_id
       WHERE rv.voucher_number = ? ORDER BY rv.created_at ASC`,
      [voucher_number]
    );
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== RECEIPT VOUCHERS ==============

exports.getReceiptVouchers = async (req, res) => {
  try {
    const { from_date, to_date, receipt_type } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT
                 rv.voucher_number,
                 rv.voucher_date,
                 MAX(rv.main_account_id) as main_account_id,
                 MAX(ma.account_name) as main_account_name,
                 MAX(rv.description) as description,
                 SUM(rv.amount) as total_amount,
                 COUNT(*) as line_count,
                 MIN(u.name) as created_by_name,
                 MIN(rv.created_at) as created_at
               FROM receipt_vouchers rv
               JOIN users u ON rv.created_by = u.user_id
               LEFT JOIN accounts ma ON rv.main_account_id = ma.account_id
               WHERE 1=1`;
    let countSql = 'SELECT COUNT(DISTINCT voucher_number) as total FROM receipt_vouchers WHERE 1=1';
    const params = [], countParams = [];

    if (from_date && to_date) {
      sql += ' AND rv.voucher_date BETWEEN ? AND ?';
      countSql += ' AND voucher_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }
    if (receipt_type) { sql += ' AND rv.receipt_type = ?'; countSql += ' AND receipt_type = ?'; params.push(receipt_type); countParams.push(receipt_type); }

    sql += ' GROUP BY rv.voucher_number, rv.voucher_date ORDER BY rv.voucher_date DESC, MIN(rv.created_at) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [vouchers, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: vouchers, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deletePaymentVoucherGroup = async (req, res) => {
  const conn = await getConnection();
  try {
    const { voucher_number } = req.params;
    const rows = await conn.query('SELECT * FROM payment_vouchers WHERE voucher_number = ?', [voucher_number]);
    if (!rows.length) return res.status(404).json({ message: 'Voucher not found' });

    await conn.beginTransaction();
    for (const voucher of rows) {
      if (voucher.journal_entry_id) {
        const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
        const [je] = await conn.query('SELECT status FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
        if (je && je.status === 'posted' && lines.length > 0) {
          const accIds = [...new Set(lines.map(l => l.account_id))];
          const accRows = await conn.query(`SELECT account_id, account_type FROM accounts WHERE account_id IN (${accIds.map(() => '?').join(',')})`, accIds);
          const typeMap = {};
          for (const a of accRows) typeMap[a.account_id] = a.account_type;
          // Aggregate reversals per account, then apply in a single CASE WHEN UPDATE
          const netChange = new Map();
          for (const line of lines) {
            const debitInc = ['asset', 'expense'].includes(typeMap[line.account_id]);
            const reversal = debitInc ? -(Number(line.debit) - Number(line.credit)) : -(Number(line.credit) - Number(line.debit));
            netChange.set(line.account_id, (netChange.get(line.account_id) || 0) + reversal);
          }
          const ncEntries = [...netChange.entries()];
          const ncCase  = ncEntries.map(() => 'WHEN ? THEN current_balance + ?').join(' ');
          const ncCaseP = ncEntries.flatMap(([id, v]) => [id, v]);
          const ncIds   = ncEntries.map(([id]) => id);
          await conn.query(
            `UPDATE accounts SET current_balance = CASE account_id ${ncCase} END WHERE account_id IN (${ncIds.map(() => '?').join(',')})`,
            [...ncCaseP, ...ncIds]
          );
        }
        await conn.query('UPDATE payment_vouchers SET journal_entry_id = NULL WHERE voucher_id = ?', [voucher.voucher_id]);
        await conn.query('DELETE FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
        await conn.query('DELETE FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
      } else {
        const [acc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.account_id]);
        if (acc) {
          const debitInc = ['asset', 'expense'].includes(acc.account_type);
          await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [debitInc ? -Number(voucher.amount) : Number(voucher.amount), voucher.account_id]);
        }
        if (voucher.main_account_id) {
          const [mainAcc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.main_account_id]);
          if (mainAcc) {
            const mainDebitInc = ['asset', 'expense'].includes(mainAcc.account_type);
            await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [mainDebitInc ? Number(voucher.amount) : -Number(voucher.amount), voucher.main_account_id]);
          }
        }
      }
    }
    await conn.query('DELETE FROM payment_vouchers WHERE voucher_number = ?', [voucher_number]);
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PAYMENT_VOUCHER_DELETED', 'payment_vouchers', 0, { voucher_number }, req.ip);
    res.json({ message: 'Payment voucher deleted' });
  } catch (err) {
    await conn.rollback();
    logger.error('deletePaymentVoucherGroup error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.getNextReceiptVoucherNumber = async (req, res) => {
  try {
    const [maxRow] = await query("SELECT MAX(CAST(SUBSTRING(voucher_number, 4) AS UNSIGNED)) as max_num FROM receipt_vouchers WHERE voucher_number REGEXP '^CRV[0-9]+'");
    const nextNumber = (maxRow?.max_num || 0) + 1;
    res.json({ voucher_number: `CRV${String(nextNumber).padStart(6, '0')}` });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

exports.createReceiptVoucher = async (req, res) => {
  const conn = await getConnection();
  try {
    const { voucher_number, voucher_date, received_from, receipt_type, account_id, main_account_id, amount, payment_method, cheque_number, bank_account_id, description } = req.body;

    if (!voucher_date || !received_from || !account_id || !amount) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const [acc] = await conn.query('SELECT account_id, account_name, account_type, is_active FROM accounts WHERE account_id = ?', [account_id]);
    if (!acc)           return res.status(400).json({ message: 'Account not found' });
    if (!acc.is_active) return res.status(400).json({ message: `Account "${acc.account_name}" is inactive` });

    await conn.beginTransaction();

    let voucherNumber = voucher_number;
    if (!voucherNumber) {
      const [maxRow] = await conn.query("SELECT MAX(CAST(SUBSTRING(voucher_number, 4) AS UNSIGNED)) as max_num FROM receipt_vouchers WHERE voucher_number REGEXP '^CRV[0-9]+'");
      const nextNumber = (maxRow?.max_num || 0) + 1;
      voucherNumber = `CRV${String(nextNumber).padStart(6, '0')}`;
    }

    // CRV: line account gets credited (income increases)
    const debitIncrease = ['asset', 'expense'].includes(acc.account_type);
    await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [debitIncrease ? -amount : amount, account_id]);

    // CRV: main account (cash/bank) gets debited — cash coming in
    if (main_account_id) {
      const [mainAcc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [main_account_id]);
      if (mainAcc) {
        const mainDebitInc = ['asset', 'expense'].includes(mainAcc.account_type);
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [mainDebitInc ? amount : -amount, main_account_id]);
      }
    }

    const result = await conn.query(
      'INSERT INTO receipt_vouchers (voucher_number, voucher_date, received_from, receipt_type, account_id, main_account_id, amount, payment_method, cheque_number, bank_account_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [voucherNumber, voucher_date, received_from, receipt_type || 'customer', account_id, main_account_id || null, amount, payment_method || 'cash', cheque_number || null, bank_account_id || null, description || null, req.user.user_id]
    );

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'RECEIPT_VOUCHER_CREATED', 'receipt_vouchers', result.insertId, { voucher_number: voucherNumber, amount }, req.ip);
    res.status(201).json({ message: 'Receipt voucher created', voucher_id: result.insertId, voucher_number: voucherNumber });
  } catch (err) {
    await conn.rollback();
    logger.error('createReceiptVoucher error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deleteReceiptVoucher = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const [voucher] = await conn.query('SELECT * FROM receipt_vouchers WHERE voucher_id = ?', [id]);
    if (!voucher) return res.status(404).json({ message: 'Voucher not found' });

    await conn.beginTransaction();

    if (voucher.journal_entry_id) {
      // Voucher was created with old double-entry — reverse JE balances
      const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
      const [je] = await conn.query('SELECT status FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
      if (je && je.status === 'posted' && lines.length > 0) {
        const accIds = [...new Set(lines.map(l => l.account_id))];
        const accRows = await conn.query(`SELECT account_id, account_type FROM accounts WHERE account_id IN (${accIds.map(() => '?').join(',')})`, accIds);
        const typeMap = {};
        for (const a of accRows) typeMap[a.account_id] = a.account_type;
        for (const line of lines) {
          const debitInc = ['asset', 'expense'].includes(typeMap[line.account_id]);
          const reversal = debitInc ? -(Number(line.debit) - Number(line.credit)) : -(Number(line.credit) - Number(line.debit));
          await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [reversal, line.account_id]);
        }
      }
      // NULL out FK before deleting JE (avoids constraint error)
      await conn.query('UPDATE receipt_vouchers SET journal_entry_id = NULL WHERE voucher_id = ?', [id]);
      await conn.query('DELETE FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
      await conn.query('DELETE FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
    } else {
      // Reverse direct balance update for line account
      const [acc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.account_id]);
      if (acc) {
        const debitInc = ['asset', 'expense'].includes(acc.account_type);
        await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [debitInc ? Number(voucher.amount) : -Number(voucher.amount), voucher.account_id]);
      }
      // Reverse main account balance (re-debit the cash that was debited)
      if (voucher.main_account_id) {
        const [mainAcc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.main_account_id]);
        if (mainAcc) {
          const mainDebitInc = ['asset', 'expense'].includes(mainAcc.account_type);
          await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [mainDebitInc ? -Number(voucher.amount) : Number(voucher.amount), voucher.main_account_id]);
        }
      }
    }

    await conn.query('DELETE FROM receipt_vouchers WHERE voucher_id = ?', [id]);
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'RECEIPT_VOUCHER_DELETED', 'receipt_vouchers', id, {}, req.ip);
    res.json({ message: 'Receipt voucher deleted' });
  } catch (err) {
    await conn.rollback();
    logger.error('deleteReceiptVoucher error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deleteReceiptVoucherGroup = async (req, res) => {
  const conn = await getConnection();
  try {
    const { voucher_number } = req.params;
    const rows = await conn.query('SELECT * FROM receipt_vouchers WHERE voucher_number = ?', [voucher_number]);
    if (!rows.length) return res.status(404).json({ message: 'Voucher not found' });

    await conn.beginTransaction();
    for (const voucher of rows) {
      if (voucher.journal_entry_id) {
        const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
        const [je] = await conn.query('SELECT status FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
        if (je && je.status === 'posted' && lines.length > 0) {
          const accIds = [...new Set(lines.map(l => l.account_id))];
          const accRows = await conn.query(`SELECT account_id, account_type FROM accounts WHERE account_id IN (${accIds.map(() => '?').join(',')})`, accIds);
          const typeMap = {};
          for (const a of accRows) typeMap[a.account_id] = a.account_type;
          // Aggregate reversals per account, then apply in a single CASE WHEN UPDATE
          const netChange = new Map();
          for (const line of lines) {
            const debitInc = ['asset', 'expense'].includes(typeMap[line.account_id]);
            const reversal = debitInc ? -(Number(line.debit) - Number(line.credit)) : -(Number(line.credit) - Number(line.debit));
            netChange.set(line.account_id, (netChange.get(line.account_id) || 0) + reversal);
          }
          const ncEntries = [...netChange.entries()];
          const ncCase  = ncEntries.map(() => 'WHEN ? THEN current_balance + ?').join(' ');
          const ncCaseP = ncEntries.flatMap(([id, v]) => [id, v]);
          const ncIds   = ncEntries.map(([id]) => id);
          await conn.query(
            `UPDATE accounts SET current_balance = CASE account_id ${ncCase} END WHERE account_id IN (${ncIds.map(() => '?').join(',')})`,
            [...ncCaseP, ...ncIds]
          );
        }
        await conn.query('UPDATE receipt_vouchers SET journal_entry_id = NULL WHERE voucher_id = ?', [voucher.voucher_id]);
        await conn.query('DELETE FROM journal_entry_lines WHERE entry_id = ?', [voucher.journal_entry_id]);
        await conn.query('DELETE FROM journal_entries WHERE entry_id = ?', [voucher.journal_entry_id]);
      } else {
        const [acc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.account_id]);
        if (acc) {
          const debitInc = ['asset', 'expense'].includes(acc.account_type);
          await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [debitInc ? -Number(voucher.amount) : Number(voucher.amount), voucher.account_id]);
        }
        if (voucher.main_account_id) {
          const [mainAcc] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [voucher.main_account_id]);
          if (mainAcc) {
            const mainDebitInc = ['asset', 'expense'].includes(mainAcc.account_type);
            await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [mainDebitInc ? -Number(voucher.amount) : Number(voucher.amount), voucher.main_account_id]);
          }
        }
      }
    }
    await conn.query('DELETE FROM receipt_vouchers WHERE voucher_number = ?', [voucher_number]);
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'RECEIPT_VOUCHER_DELETED', 'receipt_vouchers', 0, { voucher_number }, req.ip);
    res.json({ message: 'Receipt voucher deleted' });
  } catch (err) {
    await conn.rollback();
    logger.error('deleteReceiptVoucherGroup error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== ACCOUNTING ANALYTICS ==============

exports.getAccountingAnalytics = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ message: 'Date range required' });

    // 1. P&L accounts for period
    const plAccounts = await query(`
      SELECT a.account_id, a.account_name, a.account_code, a.account_type,
             COALESCE(SUM(jel.credit - jel.debit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id
        AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
      WHERE a.account_type IN ('revenue', 'expense') AND a.is_active = 1
      GROUP BY a.account_id
      HAVING amount != 0
      ORDER BY ABS(amount) DESC
    `, [from_date, to_date]);

    const revenueAccounts = plAccounts.filter(a => a.account_type === 'revenue').map(a => ({ ...a, amount: Number(a.amount) }));
    const expenseAccounts = plAccounts.filter(a => a.account_type === 'expense').map(a => ({ ...a, amount: Math.abs(Number(a.amount)) }));
    const totalRevenue = revenueAccounts.reduce((s, a) => s + a.amount, 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + a.amount, 0);

    // 2. Monthly trend (revenue vs expenses per month)
    const monthlyRows = await query(`
      SELECT
        DATE_FORMAT(je.entry_date, '%Y-%m') as month,
        a.account_type,
        SUM(CASE WHEN a.account_type = 'revenue' THEN jel.credit - jel.debit
                 ELSE jel.debit - jel.credit END) as amount
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.entry_id AND je.status = 'posted'
      JOIN accounts a ON jel.account_id = a.account_id
      WHERE je.entry_date BETWEEN ? AND ? AND a.account_type IN ('revenue', 'expense')
      GROUP BY DATE_FORMAT(je.entry_date, '%Y-%m'), a.account_type
      ORDER BY month
    `, [from_date, to_date]);

    const monthMap = {};
    for (const row of monthlyRows) {
      if (!monthMap[row.month]) monthMap[row.month] = { month: row.month, revenue: 0, expenses: 0 };
      if (row.account_type === 'revenue') monthMap[row.month].revenue = Number(row.amount);
      else monthMap[row.month].expenses = Number(row.amount);
    }
    const monthlyTrend = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // 3. Voucher summary
    const [vRow] = await query(`
      SELECT
        (SELECT COUNT(*) FROM payment_vouchers WHERE voucher_date BETWEEN ? AND ?) as cpv_count,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_vouchers WHERE voucher_date BETWEEN ? AND ?) as cpv_amount,
        (SELECT COUNT(*) FROM receipt_vouchers WHERE voucher_date BETWEEN ? AND ?) as crv_count,
        (SELECT COALESCE(SUM(amount), 0) FROM receipt_vouchers WHERE voucher_date BETWEEN ? AND ?) as crv_amount
    `, [from_date, to_date, from_date, to_date, from_date, to_date, from_date, to_date]);

    // 4. Journal entries summary
    const jvRows = await query(
      `SELECT status, COUNT(*) as count FROM journal_entries WHERE entry_date BETWEEN ? AND ? GROUP BY status`,
      [from_date, to_date]
    );
    const jvSummary = { posted: 0, draft: 0 };
    for (const r of jvRows) jvSummary[r.status] = Number(r.count);

    res.json({
      period: { from_date, to_date },
      summary: { total_revenue: totalRevenue, total_expenses: totalExpenses, net_profit: totalRevenue - totalExpenses },
      monthly_trend: monthlyTrend,
      top_revenue: revenueAccounts.slice(0, 5),
      top_expenses: expenseAccounts.slice(0, 5),
      vouchers: {
        cpv_count: Number(vRow.cpv_count),
        cpv_amount: Number(vRow.cpv_amount),
        crv_count: Number(vRow.crv_count),
        crv_amount: Number(vRow.crv_amount)
      },
      journal_summary: jvSummary
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== CASH POSITION (All Level-4 Accounts) ==============

exports.getCashPosition = async (req, res) => {
  try {
    const accounts = await query(`
      SELECT a.account_id, a.account_code, a.account_name, a.account_type,
             a.current_balance, g.group_name
      FROM accounts a
      JOIN account_groups g ON a.group_id = g.group_id
      WHERE a.level = 4 AND a.is_active = 1
      ORDER BY a.account_type, a.account_code
    `);

    let totalDr = 0, totalCr = 0;

    const data = accounts.map(a => {
      const bal = Number(a.current_balance || 0);
      const isDebitNormal = ['asset', 'expense'].includes(a.account_type);
      // asset/expense: positive stored balance = Dr side
      // liability/equity/revenue: positive stored balance = Cr side
      const dr_balance = isDebitNormal ? (bal > 0 ? bal : 0) : (bal < 0 ? Math.abs(bal) : 0);
      const cr_balance = isDebitNormal ? (bal < 0 ? Math.abs(bal) : 0) : (bal > 0 ? bal : 0);
      totalDr += dr_balance;
      totalCr += cr_balance;
      return {
        account_id:   Number(a.account_id),
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        group_name:   a.group_name,
        dr_balance,
        cr_balance
      };
    });

    res.json({ data, totals: { dr: totalDr, cr: totalCr, net: totalDr - totalCr } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
