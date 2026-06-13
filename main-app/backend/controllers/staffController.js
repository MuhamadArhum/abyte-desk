const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

let dbReady = false;
async function ensureTablesAndColumns() {
  if (dbReady) return;
  dbReady = true;
  try {
    await query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_account_id INT DEFAULT NULL`);
    await query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS time_in TIME DEFAULT NULL`);
    await query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS time_out TIME DEFAULT NULL`);
    await query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS monthly_leave_allowed INT DEFAULT 2`);
    await query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS grace_time INT DEFAULT 10`);
    await query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    await query(`CREATE TABLE IF NOT EXISTS designations (
      designation_id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      department_id INT DEFAULT NULL,
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_desig_name (name),
      INDEX idx_desig_dept (department_id)
    )`);
    await query(`CREATE TABLE IF NOT EXISTS salary_adjustments (
      adjustment_id INT PRIMARY KEY AUTO_INCREMENT,
      staff_id INT NOT NULL,
      month TINYINT NOT NULL,
      year SMALLINT NOT NULL,
      days DECIMAL(5,2) NOT NULL DEFAULT 0,
      reason TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_adj (staff_id, month, year),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE
    )`);
  } catch (e) { /* already exists */ }
}

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

exports.getAll = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { is_active, search = '', department } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT st.*, s.store_name as branch_name FROM staff st LEFT JOIN stores s ON st.branch_id = s.store_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM staff st WHERE 1=1';
    const params = [], countParams = [];

    // Branch isolation: non-admin sees their branch; admin can filter via ?filter_branch
    if (req.user.role_name !== 'Admin' && req.user.branch_id) {
      sql += ' AND st.branch_id = ?';
      countSql += ' AND st.branch_id = ?';
      params.push(req.user.branch_id);
      countParams.push(req.user.branch_id);
    } else if (req.user.role_name === 'Admin' && req.query.filter_branch) {
      sql += ' AND st.branch_id = ?';
      countSql += ' AND st.branch_id = ?';
      params.push(req.query.filter_branch);
      countParams.push(req.query.filter_branch);
    }

    if (is_active !== undefined) {
      sql += ' AND st.is_active = ?';
      countSql += ' AND st.is_active = ?';
      params.push(is_active);
      countParams.push(is_active);
    }

    if (department) {
      sql += ' AND st.department = ?';
      countSql += ' AND st.department = ?';
      params.push(department);
      countParams.push(department);
    }

    if (search) {
      const pattern = `%${search}%`;
      sql += ' AND (st.full_name LIKE ? OR st.email LIKE ? OR st.position LIKE ?)';
      countSql += ' AND (st.full_name LIKE ? OR st.email LIKE ? OR st.position LIKE ?)';
      params.push(pattern, pattern, pattern);
      countParams.push(pattern, pattern, pattern);
    }

    sql += ' ORDER BY st.full_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [staff, [{total}]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: staff, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [staff] = await query('SELECT * FROM staff WHERE staff_id = ?', [req.params.id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json(staff);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { user_id, employee_id, full_name, phone, email, address, position, department, salary, salary_type, hire_date,
            salary_account_id, time_in, time_out, monthly_leave_allowed, grace_time, branch_id } = req.body;
    if (!full_name || !hire_date) return res.status(400).json({ message: 'Name and hire date required', field: !full_name ? 'full_name' : 'hire_date' });
    if (phone && !/^[\d+\-() ]{7,20}$/.test(phone)) return res.status(400).json({ message: 'Invalid phone format', field: 'phone' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format', field: 'email' });
    if (salary !== undefined && salary !== null && Number(salary) < 0) return res.status(400).json({ message: 'Salary cannot be negative', field: 'salary' });

    // Non-admin users can only create staff in their own branch
    const assignedBranch = req.user.role_name !== 'Admin' ? (req.user.branch_id || null) : (branch_id || null);

    const result = await query(
      `INSERT INTO staff (user_id, employee_id, full_name, phone, email, address, position, department,
        salary, salary_type, hire_date, salary_account_id, time_in, time_out, monthly_leave_allowed, grace_time, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id || null, employee_id || null, full_name, phone || null, email || null, address || null,
       position || null, department || null, salary || null, salary_type || 'monthly', hire_date,
       salary_account_id || null, time_in || null, time_out || null,
       monthly_leave_allowed != null ? monthly_leave_allowed : 2, grace_time != null ? grace_time : 10,
       assignedBranch]
    );

    await logAction(req.user.user_id, req.user.name, 'STAFF_CREATED', 'staff', result.insertId, { full_name, branch_id: assignedBranch }, req.ip);
    res.status(201).json({ message: 'Staff created', staff_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { id } = req.params;
    const { employee_id, full_name, phone, email, address, position, department, salary, salary_type, is_active, leave_balance,
            salary_account_id, time_in, time_out, monthly_leave_allowed, grace_time } = req.body;
    if (!full_name) return res.status(400).json({ message: 'Name required', field: 'full_name' });
    if (phone && !/^[\d+\-() ]{7,20}$/.test(phone)) return res.status(400).json({ message: 'Invalid phone format', field: 'phone' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format', field: 'email' });
    if (salary !== undefined && salary !== null && Number(salary) < 0) return res.status(400).json({ message: 'Salary cannot be negative', field: 'salary' });

    await query(
      `UPDATE staff SET employee_id=?, full_name=?, phone=?, email=?, address=?, position=?, department=?,
        salary=?, salary_type=?, is_active=?, leave_balance=?, salary_account_id=?,
        time_in=?, time_out=?, monthly_leave_allowed=?, grace_time=?, updated_at=CURRENT_TIMESTAMP
       WHERE staff_id=?`,
      [employee_id || null, full_name, phone || null, email || null, address || null,
       position || null, department || null, salary || null, salary_type || 'monthly',
       is_active ?? 1, leave_balance ?? 20, salary_account_id || null,
       time_in || null, time_out || null,
       monthly_leave_allowed != null ? monthly_leave_allowed : 2, grace_time != null ? grace_time : 10,
       id]
    );

    await logAction(req.user.user_id, req.user.name, 'STAFF_UPDATED', 'staff', id, { full_name }, req.ip);
    res.json({ message: 'Staff updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const { staff_id, attendance_date, check_in, check_out, status, notes } = req.body;
    if (!staff_id || !attendance_date) return res.status(400).json({ message: 'Staff and date required' });
    const validStatuses = ['present', 'absent', 'half_day', 'leave', 'holiday'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status', field: 'status' });

    const newStatus = status || 'present';

    // Check existing record for leave balance tracking
    const [existing] = await query('SELECT status FROM attendance WHERE staff_id = ? AND attendance_date = ?', [staff_id, attendance_date]);
    const oldStatus = existing ? existing.status : null;

    await query(
      'INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE check_in=?, check_out=?, status=?, notes=?',
      [staff_id, attendance_date, check_in || null, check_out || null, newStatus, notes || null, check_in || null, check_out || null, newStatus, notes || null]
    );

    // Adjust leave balance
    if (oldStatus !== 'leave' && newStatus === 'leave') {
      await query('UPDATE staff SET leave_balance = GREATEST(leave_balance - 1, 0) WHERE staff_id = ?', [staff_id]);
    } else if (oldStatus === 'leave' && newStatus !== 'leave') {
      await query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [staff_id]);
    }

    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_MARKED', 'attendance', staff_id, { attendance_date, status: newStatus }, req.ip);
    res.json({ message: 'Attendance marked' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const { staff_id, start_date, end_date, status } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT a.*, s.full_name, s.position FROM attendance a JOIN staff s ON a.staff_id = s.staff_id WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM attendance a JOIN staff s ON a.staff_id = s.staff_id WHERE 1=1';
    let summarySql = `SELECT
      SUM(a.status = 'present') as present,
      SUM(a.status = 'absent') as absent,
      SUM(a.status = 'half_day') as half_day,
      SUM(a.status = 'leave') as on_leave,
      COUNT(*) as total
      FROM attendance a JOIN staff s ON a.staff_id = s.staff_id WHERE 1=1`;
    const params = [], countParams = [], summaryParams = [];

    if (req.user.role_name !== 'Admin' && req.user.branch_id) {
      sql += ' AND s.branch_id = ?';
      countSql += ' AND s.branch_id = ?';
      summarySql += ' AND s.branch_id = ?';
      params.push(req.user.branch_id);
      countParams.push(req.user.branch_id);
      summaryParams.push(req.user.branch_id);
    } else if (req.user.role_name === 'Admin' && req.query.filter_branch) {
      sql += ' AND s.branch_id = ?';
      countSql += ' AND s.branch_id = ?';
      summarySql += ' AND s.branch_id = ?';
      params.push(req.query.filter_branch);
      countParams.push(req.query.filter_branch);
      summaryParams.push(req.query.filter_branch);
    }

    if (staff_id) {
      sql += ' AND a.staff_id = ?';
      countSql += ' AND a.staff_id = ?';
      summarySql += ' AND a.staff_id = ?';
      params.push(staff_id);
      countParams.push(staff_id);
      summaryParams.push(staff_id);
    }

    if (start_date && end_date) {
      sql += ' AND a.attendance_date BETWEEN ? AND ?';
      countSql += ' AND attendance_date BETWEEN ? AND ?';
      summarySql += ' AND attendance_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
      countParams.push(start_date, end_date);
      summaryParams.push(start_date, end_date);
    }

    if (status) {
      sql += ' AND a.status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    sql += ' ORDER BY a.attendance_date DESC, s.full_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [attendance, [{total}], [summary]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
      query(summarySql, summaryParams)
    ]);

    res.json({
      data: attendance,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        present: Number(summary.present || 0),
        absent: Number(summary.absent || 0),
        halfDay: Number(summary.half_day || 0),
        leave: Number(summary.on_leave || 0),
        total: Number(summary.total || 0)
      }
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markBulkAttendance = async (req, res) => {
  const conn = await getConnection();
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Records array required' });
    }

    await conn.beginTransaction();

    for (const record of records) {
      const { staff_id, attendance_date, check_in, check_out, status, notes } = record;
      const newStatus = status || 'present';

      // Check existing for leave balance
      const [existing] = await conn.query('SELECT status FROM attendance WHERE staff_id = ? AND attendance_date = ?', [staff_id, attendance_date]);
      const oldStatus = existing ? existing.status : null;

      await conn.query(
        'INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE check_in=?, check_out=?, status=?, notes=?',
        [staff_id, attendance_date, check_in || null, check_out || null, newStatus, notes || null, check_in || null, check_out || null, newStatus, notes || null]
      );

      // Adjust leave balance
      if (oldStatus !== 'leave' && newStatus === 'leave') {
        await conn.query('UPDATE staff SET leave_balance = GREATEST(leave_balance - 1, 0) WHERE staff_id = ?', [staff_id]);
      } else if (oldStatus === 'leave' && newStatus !== 'leave') {
        await conn.query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [staff_id]);
      }
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'BULK_ATTENDANCE_MARKED', 'attendance', null, { count: records.length }, req.ip);
    res.json({ message: `Attendance marked for ${records.length} staff members` });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE staff SET is_active = 0 WHERE staff_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'STAFF_DEACTIVATED', 'staff', id, {}, req.ip);
    res.json({ message: 'Staff deactivated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStaffAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 30 } = req.query;
    const attendance = await query(
      'SELECT * FROM attendance WHERE staff_id = ? ORDER BY attendance_date DESC LIMIT ?',
      [id, parseInt(limit)]
    );
    res.json({ data: attendance });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalaryPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    const payments = await query(
      'SELECT * FROM salary_payments WHERE staff_id = ? ORDER BY payment_date DESC LIMIT ?',
      [id, parseInt(limit)]
    );
    res.json({ data: payments });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.paySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes } = req.body;

    if (!payment_date || !from_date || !to_date || !amount || net_amount === undefined) {
      return res.status(400).json({ message: 'Required fields missing' });
    }
    if (new Date(from_date) > new Date(to_date)) {
      return res.status(400).json({ message: 'From date must be before to date', field: 'from_date' });
    }
    if (Number(amount) < 0) return res.status(400).json({ message: 'Amount cannot be negative', field: 'amount' });

    const expectedNet = Number(amount) - Number(deductions || 0) + Number(bonuses || 0);
    if (Math.abs(expectedNet - Number(net_amount)) > 0.01) {
      return res.status(400).json({ message: 'Net amount calculation mismatch', field: 'net_amount' });
    }

    const result = await query(
      'INSERT INTO salary_payments (staff_id, payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, payment_date, from_date, to_date, amount, deductions || 0, bonuses || 0, net_amount, payment_method || 'bank_transfer', notes || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'SALARY_PAID', 'salary_payment', result.insertId, { staff_id: id, amount: net_amount }, req.ip);
    res.status(201).json({ message: 'Salary payment recorded' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== EDIT/DELETE ENDPOINTS ==============

exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { check_in, check_out, status, notes } = req.body;
    const validStatuses = ['present', 'absent', 'half_day', 'leave', 'holiday'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status', field: 'status' });

    const [record] = await query('SELECT * FROM attendance WHERE attendance_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    const oldStatus = record.status;
    const newStatus = status || record.status;

    await query(
      'UPDATE attendance SET check_in=?, check_out=?, status=?, notes=? WHERE attendance_id=?',
      [check_in || null, check_out || null, newStatus, notes || null, id]
    );

    // Adjust leave balance
    if (oldStatus !== 'leave' && newStatus === 'leave') {
      await query('UPDATE staff SET leave_balance = GREATEST(leave_balance - 1, 0) WHERE staff_id = ?', [record.staff_id]);
    } else if (oldStatus === 'leave' && newStatus !== 'leave') {
      await query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [record.staff_id]);
    }

    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_UPDATED', 'attendance', id, { staff_id: record.staff_id, old_status: oldStatus, new_status: newStatus, attendance_date: record.attendance_date }, req.ip);
    res.json({ message: 'Attendance updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const [record] = await query('SELECT * FROM attendance WHERE attendance_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    // Reverse leave deduction if status was leave
    if (record.status === 'leave') {
      await query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [record.staff_id]);
    }

    await query('DELETE FROM attendance WHERE attendance_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_DELETED', 'attendance', id, { staff_id: record.staff_id, attendance_date: record.attendance_date }, req.ip);
    res.json({ message: 'Attendance deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes } = req.body;

    const [record] = await query('SELECT * FROM salary_payments WHERE payment_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Salary payment not found' });

    if (!payment_date || !from_date || !to_date || !amount || net_amount === undefined) {
      return res.status(400).json({ message: 'Required fields missing' });
    }
    if (new Date(from_date) > new Date(to_date)) {
      return res.status(400).json({ message: 'From date must be before to date', field: 'from_date' });
    }
    if (Number(amount) < 0) return res.status(400).json({ message: 'Amount cannot be negative', field: 'amount' });

    const expectedNet = Number(amount) - Number(deductions || 0) + Number(bonuses || 0);
    if (Math.abs(expectedNet - Number(net_amount)) > 0.01) {
      return res.status(400).json({ message: 'Net amount calculation mismatch', field: 'net_amount' });
    }

    await query(
      'UPDATE salary_payments SET payment_date=?, from_date=?, to_date=?, amount=?, deductions=?, bonuses=?, net_amount=?, payment_method=?, notes=? WHERE payment_id=?',
      [payment_date, from_date, to_date, amount, deductions || 0, bonuses || 0, net_amount, payment_method || 'bank_transfer', notes || null, id]
    );

    await logAction(req.user.user_id, req.user.name, 'SALARY_PAYMENT_UPDATED', 'salary_payment', id, { staff_id: record.staff_id, amount: net_amount }, req.ip);
    res.json({ message: 'Salary payment updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const [record] = await query('SELECT * FROM salary_payments WHERE payment_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Salary payment not found' });

    await query('DELETE FROM salary_payments WHERE payment_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'SALARY_PAYMENT_DELETED', 'salary_payment', id, { staff_id: record.staff_id, amount: record.net_amount }, req.ip);
    res.json({ message: 'Salary payment deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== REPORT ENDPOINTS ==============

exports.getMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Month required (YYYY-MM format)' });
    }

    const startDate = `${month}-01`;

    let branchWhere = 's.is_active = 1';
    const branchParams = [startDate, startDate];
    if (req.user.role_name !== 'Admin' && req.user.branch_id) {
      branchWhere += ' AND s.branch_id = ?';
      branchParams.push(req.user.branch_id);
    } else if (req.user.role_name === 'Admin' && req.query.filter_branch) {
      branchWhere += ' AND s.branch_id = ?';
      branchParams.push(req.query.filter_branch);
    }

    const data = await query(`
      SELECT
        s.staff_id, s.full_name, s.department, s.position, s.leave_balance,
        SUM(a.status = 'present') as days_present,
        SUM(a.status = 'absent') as days_absent,
        SUM(a.status = 'half_day') as days_half_day,
        SUM(a.status = 'leave') as days_leave,
        SUM(a.status = 'holiday') as days_holiday,
        COUNT(a.attendance_id) as total_records,
        ROUND(
          (SUM(a.status = 'present') + SUM(a.status = 'half_day') * 0.5) /
          NULLIF(SUM(a.status != 'holiday'), 0) * 100, 1
        ) as attendance_percentage
      FROM staff s
      LEFT JOIN attendance a ON s.staff_id = a.staff_id
        AND a.attendance_date BETWEEN ? AND LAST_DAY(?)
      WHERE ${branchWhere}
      GROUP BY s.staff_id
      ORDER BY s.full_name
    `, branchParams);

    res.json({
      month,
      data: data.map(r => ({
        ...r,
        days_present: Number(r.days_present || 0),
        days_absent: Number(r.days_absent || 0),
        days_half_day: Number(r.days_half_day || 0),
        days_leave: Number(r.days_leave || 0),
        days_holiday: Number(r.days_holiday || 0),
        total_records: Number(r.total_records || 0),
        attendance_percentage: r.attendance_percentage !== null ? Number(r.attendance_percentage) : 0
      }))
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalarySummaryReport = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
      return res.status(400).json({ message: 'from_date and to_date required' });
    }

    let branchJoin = '';
    const paidParams = [from_date, to_date];
    const expParams = [];
    if (req.user.role_name !== 'Admin' && req.user.branch_id) {
      branchJoin = ' AND s.branch_id = ?';
      paidParams.push(req.user.branch_id);
      expParams.push(req.user.branch_id);
    } else if (req.user.role_name === 'Admin' && req.query.filter_branch) {
      branchJoin = ' AND s.branch_id = ?';
      paidParams.push(req.query.filter_branch);
      expParams.push(req.query.filter_branch);
    }

    const byDepartment = await query(`
      SELECT
        COALESCE(s.department, 'Unassigned') as department,
        COUNT(DISTINCT sp.staff_id) as staff_paid,
        SUM(sp.amount) as total_base,
        SUM(sp.deductions) as total_deductions,
        SUM(sp.bonuses) as total_bonuses,
        SUM(sp.net_amount) as total_net_paid
      FROM salary_payments sp
      JOIN staff s ON sp.staff_id = s.staff_id
      WHERE sp.payment_date BETWEEN ? AND ?${branchJoin}
      GROUP BY s.department
    `, paidParams);

    const expected = await query(`
      SELECT
        COALESCE(department, 'Unassigned') as department,
        COUNT(*) as total_staff,
        SUM(salary) as total_expected_salary
      FROM staff
      WHERE is_active = 1 AND salary IS NOT NULL${branchJoin ? ' AND branch_id = ?' : ''}
      GROUP BY department
    `, expParams);

    // Merge expected into byDepartment
    const deptMap = {};
    for (const e of expected) {
      deptMap[e.department] = { total_staff: Number(e.total_staff), total_expected: Number(e.total_expected_salary || 0) };
    }

    const departments = byDepartment.map(d => {
      const exp = deptMap[d.department] || { total_staff: 0, total_expected: 0 };
      const netPaid = Number(d.total_net_paid || 0);
      return {
        department: d.department,
        total_staff: exp.total_staff,
        staff_paid: Number(d.staff_paid || 0),
        total_base: Number(d.total_base || 0),
        total_deductions: Number(d.total_deductions || 0),
        total_bonuses: Number(d.total_bonuses || 0),
        total_net_paid: netPaid,
        total_expected: exp.total_expected,
        pending_amount: Math.max(0, exp.total_expected - netPaid)
      };
    });

    // Also include departments with staff but no payments
    for (const [dept, exp] of Object.entries(deptMap)) {
      if (!departments.find(d => d.department === dept)) {
        departments.push({
          department: dept,
          total_staff: exp.total_staff,
          staff_paid: 0,
          total_base: 0, total_deductions: 0, total_bonuses: 0,
          total_net_paid: 0,
          total_expected: exp.total_expected,
          pending_amount: exp.total_expected
        });
      }
    }

    const totals = departments.reduce((acc, d) => ({
      total_staff: acc.total_staff + d.total_staff,
      staff_paid: acc.staff_paid + d.staff_paid,
      total_net_paid: acc.total_net_paid + d.total_net_paid,
      total_expected: acc.total_expected + d.total_expected
    }), { total_staff: 0, staff_paid: 0, total_net_paid: 0, total_expected: 0 });

    res.json({
      period: { from_date, to_date },
      by_department: departments,
      totals
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== SALARY SHEET ==============

exports.getSalarySheet = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { department, month, year } = req.query;
    const now = new Date();
    const m = parseInt(month) || (now.getMonth() + 1);
    const y = parseInt(year) || now.getFullYear();

    const [{ holidays_count }] = await query(
      'SELECT COUNT(*) as holidays_count FROM holidays WHERE MONTH(holiday_date) = ? AND YEAR(holiday_date) = ?',
      [m, y]
    );
    const daysInMonth  = new Date(y, m, 0).getDate();
    const holidays     = Number(holidays_count);
    // Daily rate denominator = total days in month (holidays are paid so salary / days_in_month)
    const rate_base    = daysInMonth;

    let sql = `
      SELECT s.staff_id, s.employee_id, s.full_name, s.department, s.position,
             s.salary, s.salary_type, COALESCE(s.monthly_leave_allowed, 2) as monthly_leave_allowed,
             s.salary_account_id,
             acc.account_name    as salary_account_name,
             acc.account_code    as salary_account_code,
             acc.current_balance as salary_account_balance,
             COUNT(CASE WHEN a.status = 'present'  THEN 1 END) as present_days,
             COUNT(CASE WHEN a.status = 'absent'   THEN 1 END) as absent_days,
             COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_days,
             COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.monthly_deduction ELSE 0 END), 0) as loan_deduction,
             COALESCE((SELECT SUM(ap.amount) FROM advance_payments ap
                       WHERE ap.staff_id = s.staff_id AND MONTH(ap.payment_date) = ? AND YEAR(ap.payment_date) = ?), 0) as advance_deduction,
             COALESCE((SELECT sa.days FROM salary_adjustments sa
                       WHERE sa.staff_id = s.staff_id AND sa.month = ? AND sa.year = ?), 0) as adjustment_days,
             COALESCE((SELECT sa.reason FROM salary_adjustments sa
                       WHERE sa.staff_id = s.staff_id AND sa.month = ? AND sa.year = ?), NULL) as adjustment_reason,
             COALESCE((
               SELECT SUM(CASE WHEN sc.calculation='percentage'
                               THEN s.salary * COALESCE(ssc.custom_value, sc.default_value) / 100
                               ELSE COALESCE(ssc.custom_value, sc.default_value) END)
               FROM staff_salary_components ssc
               JOIN salary_components sc ON ssc.component_id = sc.component_id
               WHERE ssc.staff_id = s.staff_id AND ssc.is_active = 1
                 AND sc.is_active = 1 AND sc.type = 'allowance'
             ), 0) as total_allowances,
             COALESCE((
               SELECT SUM(CASE WHEN sc.calculation='percentage'
                               THEN s.salary * COALESCE(ssc.custom_value, sc.default_value) / 100
                               ELSE COALESCE(ssc.custom_value, sc.default_value) END)
               FROM staff_salary_components ssc
               JOIN salary_components sc ON ssc.component_id = sc.component_id
               WHERE ssc.staff_id = s.staff_id AND ssc.is_active = 1
                 AND sc.is_active = 1 AND sc.type = 'deduction'
             ), 0) as total_comp_deductions
      FROM staff s
      LEFT JOIN accounts acc ON s.salary_account_id = acc.account_id
      LEFT JOIN attendance a ON s.staff_id = a.staff_id
           AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?
      LEFT JOIN staff_loans l ON s.staff_id = l.staff_id AND l.status = 'active'
      WHERE s.is_active = 1
    `;
    const params = [m, y, m, y, m, y, m, y];
    if (department) { sql += ' AND s.department = ?'; params.push(department); }
    sql += ' GROUP BY s.staff_id ORDER BY s.department, s.full_name';

    const data = await query(sql, params);
    const sheet = data.map(r => {
      const salary               = Number(r.salary || 0);
      const daily_rate           = rate_base > 0 ? salary / rate_base : 0;
      const present_days         = Number(r.present_days || 0);
      const absent_days          = Number(r.absent_days  || 0);
      const half_days            = Number(r.half_days    || 0);
      const monthly_leave_allowed = Number(r.monthly_leave_allowed || 2);
      const adjustment_days      = Number(r.adjustment_days || 0);
      const loan_deduction       = Number(r.loan_deduction || 0);
      const advance_deduction    = Number(r.advance_deduction || 0);
      const total_allowances     = Number(r.total_allowances || 0);
      const total_comp_deductions = Number(r.total_comp_deductions || 0);
      const salary_account_balance = r.salary_account_balance !== null && r.salary_account_balance !== undefined
                                       ? Number(r.salary_account_balance) : null;

      // Total payable days = present (half=0.5) + allowed leaves (fixed quota) + holidays + adjustment
      const present_eq      = present_days + half_days * 0.5;
      const total_attendance = +(present_eq + monthly_leave_allowed + holidays + adjustment_days).toFixed(2);

      // Earned salary = daily_rate × total_attendance
      const earned_salary   = +(daily_rate * total_attendance).toFixed(2);

      // Gross = earned + allowance components
      const gross_salary    = +(earned_salary + total_allowances).toFixed(2);

      // Deduction = linked salary account balance; comp deductions = deduction-type components
      const account_deduction = salary_account_balance !== null ? +salary_account_balance.toFixed(2) : 0;
      const net_salary = +(gross_salary - account_deduction - total_comp_deductions).toFixed(2);

      return {
        staff_id:   r.staff_id,
        employee_id: r.employee_id,
        full_name:  r.full_name,
        department: r.department,
        position:   r.position,
        salary,
        daily_rate: +daily_rate.toFixed(2),
        present_days,
        absent_days,
        half_days,
        monthly_leave_allowed,
        holidays,
        adjustment_days,
        adjustment_reason: r.adjustment_reason || null,
        total_attendance,
        earned_salary,
        total_allowances:       +total_allowances.toFixed(2),
        gross_salary,
        total_comp_deductions:  +total_comp_deductions.toFixed(2),
        loan_deduction,
        advance_deduction,
        net_salary,
        salary_account_id:      r.salary_account_id || null,
        salary_account_name:    r.salary_account_name || null,
        salary_account_code:    r.salary_account_code || null,
        salary_account_balance,
      };
    });

    res.json({
      data: sheet,
      meta: { month: m, year: y, holidays, days_in_month: daysInMonth }
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.setSalaryAdjustment = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { staff_id, month, year, days, reason } = req.body;
    if (!staff_id || !month || !year) return res.status(400).json({ message: 'staff_id, month, year required' });
    if (days === 0 || days === null || days === undefined) {
      await query('DELETE FROM salary_adjustments WHERE staff_id = ? AND month = ? AND year = ?', [staff_id, month, year]);
    } else {
      await query(
        `INSERT INTO salary_adjustments (staff_id, month, year, days, reason, created_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE days = ?, reason = ?, created_by = ?`,
        [staff_id, month, year, days, reason || null, req.user.user_id,
         days, reason || null, req.user.user_id]
      );
    }
    await logAction(req.user.user_id, req.user.name, 'SALARY_ADJUSTMENT', 'salary_adjustments', staff_id, { month, year, days, reason }, req.ip);
    res.json({ message: 'Adjustment saved' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalaryVoucher = async (req, res) => {
  try {
    const { staff_id, month, year } = req.query;
    if (!staff_id) return res.status(400).json({ message: 'staff_id required' });
    const now = new Date();
    const m = parseInt(month) || (now.getMonth() + 1);
    const y = parseInt(year) || now.getFullYear();

    const [staff] = await query('SELECT s.*, acc.account_name as salary_account_name, acc.account_code as salary_account_code, acc.current_balance as salary_account_balance FROM staff s LEFT JOIN accounts acc ON s.salary_account_id = acc.account_id WHERE s.staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Employee not found' });

    const [{ holidays_count }] = await query(
      'SELECT COUNT(*) as holidays_count FROM holidays WHERE MONTH(holiday_date) = ? AND YEAR(holiday_date) = ?', [m, y]
    );
    const daysInMonth = new Date(y, m, 0).getDate();
    const holidays    = Number(holidays_count);

    const [att] = await query(`
      SELECT COUNT(CASE WHEN status='present'  THEN 1 END) as present_days,
             COUNT(CASE WHEN status='absent'   THEN 1 END) as absent_days,
             COUNT(CASE WHEN status='half_day' THEN 1 END) as half_days,
             COUNT(CASE WHEN status='leave'    THEN 1 END) as leave_days
      FROM attendance WHERE staff_id=? AND MONTH(attendance_date)=? AND YEAR(attendance_date)=?
    `, [staff_id, m, y]);

    await ensureTablesAndColumns();
    const [adjRow] = await query(
      'SELECT days, reason FROM salary_adjustments WHERE staff_id=? AND month=? AND year=?', [staff_id, m, y]
    );

    // Salary components
    const compRows = await query(`
      SELECT sc.name, sc.type, sc.calculation,
             COALESCE(ssc.custom_value, sc.default_value) as value
      FROM staff_salary_components ssc
      JOIN salary_components sc ON ssc.component_id = sc.component_id
      WHERE ssc.staff_id = ? AND ssc.is_active = 1 AND sc.is_active = 1
    `, [staff_id]);

    const salary   = Number(staff.salary || 0);
    const monthly_leave_allowed = Number(staff.monthly_leave_allowed || 2);
    const daily_rate = daysInMonth > 0 ? salary / daysInMonth : 0;

    const present_days = Number(att?.present_days || 0);
    const absent_days  = Number(att?.absent_days  || 0);
    const half_days    = Number(att?.half_days    || 0);
    const leave_days   = Number(att?.leave_days   || 0);
    const adjustment_days  = Number(adjRow?.days   || 0);
    const adjustment_reason = adjRow?.reason || null;

    const present_eq      = present_days + half_days * 0.5;
    const total_attendance = +(present_eq + monthly_leave_allowed + holidays + adjustment_days).toFixed(2);
    const earned_salary    = +(daily_rate * total_attendance).toFixed(2);

    let total_allowances = 0, total_comp_deductions = 0;
    const allowance_items = [], deduction_items = [];
    for (const c of compRows) {
      const val = c.calculation === 'percentage' ? salary * Number(c.value) / 100 : Number(c.value);
      if (c.type === 'allowance') { total_allowances += val; allowance_items.push({ name: c.name, value: +val.toFixed(2) }); }
      else                        { total_comp_deductions += val; deduction_items.push({ name: c.name, value: +val.toFixed(2) }); }
    }

    const gross_salary = +(earned_salary + total_allowances).toFixed(2);
    const salary_account_balance = staff.salary_account_balance !== null ? Number(staff.salary_account_balance) : null;
    const account_deduction = salary_account_balance !== null ? +salary_account_balance.toFixed(2) : 0;
    const net_pay = +(gross_salary - account_deduction - total_comp_deductions).toFixed(2);

    res.json({
      staff: {
        staff_id: staff.staff_id, employee_id: staff.employee_id, full_name: staff.full_name,
        department: staff.department, position: staff.position, salary_type: staff.salary_type,
        salary_account_id: staff.salary_account_id, salary_account_name: staff.salary_account_name,
        salary_account_code: staff.salary_account_code,
      },
      month: m, year: y, days_in_month: daysInMonth, holidays,
      present_days, absent_days, half_days, leave_days,
      monthly_leave_allowed, adjustment_days, adjustment_reason,
      total_attendance,
      basic_salary:   salary,
      daily_rate:     +daily_rate.toFixed(2),
      earned_salary,
      allowance_items, total_allowances: +total_allowances.toFixed(2),
      gross_salary,
      deduction_items, total_comp_deductions: +total_comp_deductions.toFixed(2),
      account_deduction,
      salary_account_balance,
      net_pay,
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== DAILY ATTENDANCE ==============

exports.getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date required (YYYY-MM-DD)' });

    const data = await query(`
      SELECT s.staff_id, s.employee_id, s.full_name, s.department, s.position,
             a.attendance_id, a.check_in, a.check_out, a.status, a.notes
      FROM staff s
      LEFT JOIN attendance a ON s.staff_id = a.staff_id AND a.attendance_date = ?
      WHERE s.is_active = 1
      ORDER BY s.full_name
    `, [date]);

    const summary = {
      total: data.length,
      present: data.filter(r => r.status === 'present').length,
      absent: data.filter(r => r.status === 'absent').length,
      half_day: data.filter(r => r.status === 'half_day').length,
      leave: data.filter(r => r.status === 'leave').length,
      holiday: data.filter(r => r.status === 'holiday').length,
      unmarked: data.filter(r => !r.status).length
    };

    res.json({ date, data, summary });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== EMPLOYEE LEDGER ==============

exports.getEmployeeLedger = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { from_date, to_date } = req.query;

    const [staff] = await query('SELECT staff_id, employee_id, full_name, department, position, salary FROM staff WHERE staff_id = ?', [staffId]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    let dateFilter = '';
    const params = [staffId];
    if (from_date && to_date) {
      dateFilter = ' AND date_col BETWEEN ? AND ?';
      params.push(from_date, to_date);
    }

    // Salary payments
    const salaryParams = [staffId];
    let salarySql = 'SELECT payment_id, payment_date as date, amount, deductions, bonuses, net_amount, payment_method, notes FROM salary_payments WHERE staff_id = ?';
    if (from_date && to_date) { salarySql += ' AND payment_date BETWEEN ? AND ?'; salaryParams.push(from_date, to_date); }
    salarySql += ' ORDER BY payment_date DESC';
    const salaryPayments = await query(salarySql, salaryParams);

    // Loans
    const loanParams = [staffId];
    let loanSql = 'SELECT l.*, (SELECT COALESCE(SUM(amount),0) FROM loan_repayments WHERE loan_id = l.loan_id) as total_repaid FROM staff_loans l WHERE l.staff_id = ?';
    if (from_date && to_date) { loanSql += ' AND l.loan_date BETWEEN ? AND ?'; loanParams.push(from_date, to_date); }
    loanSql += ' ORDER BY l.loan_date DESC';
    const loans = await query(loanSql, loanParams);

    // Loan repayments
    const repayParams = [staffId];
    let repaySql = 'SELECT r.*, l.loan_amount FROM loan_repayments r JOIN staff_loans l ON r.loan_id = l.loan_id WHERE r.staff_id = ?';
    if (from_date && to_date) { repaySql += ' AND r.repayment_date BETWEEN ? AND ?'; repayParams.push(from_date, to_date); }
    repaySql += ' ORDER BY r.repayment_date DESC';
    const repayments = await query(repaySql, repayParams);

    // Attendance summary
    const attParams = [staffId];
    let attSql = `SELECT
      SUM(status = 'present') as present,
      SUM(status = 'absent') as absent,
      SUM(status = 'half_day') as half_day,
      SUM(status = 'leave') as on_leave,
      SUM(status = 'holiday') as holiday,
      COUNT(*) as total
      FROM attendance WHERE staff_id = ?`;
    if (from_date && to_date) { attSql += ' AND attendance_date BETWEEN ? AND ?'; attParams.push(from_date, to_date); }
    const [attSummary] = await query(attSql, attParams);

    // Totals
    const totalEarned = salaryPayments.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
    const totalLoans = loans.reduce((sum, l) => sum + Number(l.loan_amount || 0), 0);
    const totalRepaid = repayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const outstandingLoanBalance = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + Number(l.remaining_balance || 0), 0);

    res.json({
      staff,
      salary_payments: salaryPayments,
      loans,
      repayments,
      attendance_summary: {
        present: Number(attSummary.present || 0),
        absent: Number(attSummary.absent || 0),
        half_day: Number(attSummary.half_day || 0),
        leave: Number(attSummary.on_leave || 0),
        holiday: Number(attSummary.holiday || 0),
        total: Number(attSummary.total || 0)
      },
      totals: { totalEarned, totalLoans, totalRepaid, outstandingLoanBalance }
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== LOAN MANAGEMENT ==============

exports.getLoans = async (req, res) => {
  try {
    const { status, staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT l.*, s.full_name, s.employee_id, s.department,
               (SELECT COALESCE(SUM(amount),0) FROM loan_repayments WHERE loan_id = l.loan_id) as total_repaid
               FROM staff_loans l JOIN staff s ON l.staff_id = s.staff_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM staff_loans l WHERE 1=1';
    const params = [], countParams = [];

    if (status) { sql += ' AND l.status = ?'; countSql += ' AND l.status = ?'; params.push(status); countParams.push(status); }
    if (staff_id) { sql += ' AND l.staff_id = ?'; countSql += ' AND l.staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [loans, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: loans, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

async function autoPostJournalEntry(conn, { description, entry_date, lines, userId }) {
  const [lastEntry] = await conn.query('SELECT entry_number FROM journal_entries ORDER BY entry_id DESC LIMIT 1');
  const lastNum = lastEntry ? parseInt(lastEntry.entry_number.replace(/\D/g, '')) || 0 : 0;
  const entryNumber = `JV-${String(lastNum + 1).padStart(5, '0')}`;
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  const [entryResult] = await conn.query(
    'INSERT INTO journal_entries (entry_number, entry_date, description, total_debit, total_credit, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [entryNumber, entry_date, description, totalDebit, totalCredit, userId, 'draft']
  );
  const entryId = entryResult.insertId;

  for (const line of lines) {
    await conn.query(
      'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, ?)',
      [entryId, line.account_id, line.description || description, line.debit || 0, line.credit || 0]
    );
  }

  // Fetch account types to compute balance changes
  const accountIds = [...new Set(lines.map(l => l.account_id))];
  const accs = await conn.query(`SELECT account_id, account_type FROM accounts WHERE account_id IN (${accountIds.map(() => '?').join(',')})`, accountIds);
  const typeMap = {};
  for (const a of accs) typeMap[a.account_id] = a.account_type;

  const caseWhen = lines.map(() => 'WHEN ? THEN current_balance + ?').join(' ');
  const caseParams = [];
  for (const line of lines) {
    const debitIncrease = ['asset', 'expense'].includes(typeMap[line.account_id]);
    caseParams.push(line.account_id, debitIncrease ? (Number(line.debit) - Number(line.credit)) : (Number(line.credit) - Number(line.debit)));
  }
  await conn.query(`UPDATE accounts SET current_balance = CASE account_id ${caseWhen} END WHERE account_id IN (${accountIds.map(() => '?').join(',')})`, [...caseParams, ...accountIds]);
  await conn.query('UPDATE journal_entries SET status = ?, posted_at = CURRENT_TIMESTAMP WHERE entry_id = ?', ['posted', entryId]);
  return entryId;
}

exports.createLoan = async (req, res) => {
  const conn = await getConnection();
  try {
    const { staff_id, loan_amount, monthly_deduction, loan_date, reason, debit_account_id, credit_account_id } = req.body;
    if (!staff_id || !loan_amount || !loan_date) return res.status(400).json({ message: 'Staff, amount and date required' });
    if (Number(loan_amount) <= 0) return res.status(400).json({ message: 'Amount must be positive', field: 'loan_amount' });

    const [staff] = await query('SELECT full_name FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO staff_loans (staff_id, loan_amount, remaining_balance, monthly_deduction, loan_date, reason, approved_by, debit_account_id, credit_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [staff_id, loan_amount, loan_amount, monthly_deduction || 0, loan_date, reason || null, req.user.user_id, debit_account_id || null, credit_account_id || null]
    );

    // Auto-post journal entry if both accounts provided
    if (debit_account_id && credit_account_id) {
      const desc = `Loan issued to ${staff.full_name} — ${currency_fmt(loan_amount)}`;
      await autoPostJournalEntry(conn, {
        description: desc, entry_date: loan_date, userId: req.user.user_id,
        lines: [
          { account_id: debit_account_id,  debit: loan_amount, credit: 0, description: desc },
          { account_id: credit_account_id, debit: 0, credit: loan_amount, description: desc },
        ]
      });
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'LOAN_ISSUED', 'staff_loans', result.insertId, { staff_id, loan_amount, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Loan issued', loan_id: result.insertId });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

const currency_fmt = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

exports.repayLoan = async (req, res) => {
  const conn = await getConnection();
  try {
    const { loanId } = req.params;
    const { amount, repayment_date, payment_method, notes } = req.body;
    if (!amount || !repayment_date) return res.status(400).json({ message: 'Amount and date required' });
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive', field: 'amount' });

    await conn.beginTransaction();

    const [loan] = await conn.query('SELECT l.*, s.full_name FROM staff_loans l JOIN staff s ON l.staff_id = s.staff_id WHERE l.loan_id = ? FOR UPDATE', [loanId]);
    if (!loan) { await conn.rollback(); return res.status(404).json({ message: 'Loan not found' }); }
    if (loan.status !== 'active') { await conn.rollback(); return res.status(400).json({ message: 'Loan is not active' }); }
    if (Number(amount) > Number(loan.remaining_balance)) { await conn.rollback(); return res.status(400).json({ message: 'Amount exceeds remaining balance', field: 'amount' }); }

    const newBalance = Number(loan.remaining_balance) - Number(amount);

    await conn.query(
      'INSERT INTO loan_repayments (loan_id, staff_id, amount, repayment_date, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [loanId, loan.staff_id, amount, repayment_date, payment_method || 'cash', notes || null]
    );

    await conn.query(
      'UPDATE staff_loans SET remaining_balance = ?, status = ? WHERE loan_id = ?',
      [newBalance, newBalance <= 0 ? 'completed' : 'active', loanId]
    );

    // Auto-post reverse journal entry if accounts are linked on the loan
    if (loan.debit_account_id && loan.credit_account_id) {
      const desc = `Loan repayment from ${loan.full_name} — ${currency_fmt(amount)}`;
      await autoPostJournalEntry(conn, {
        description: desc, entry_date: repayment_date, userId: req.user.user_id,
        lines: [
          { account_id: loan.credit_account_id, debit: amount, credit: 0, description: desc },
          { account_id: loan.debit_account_id,  debit: 0, credit: amount, description: desc },
        ]
      });
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'LOAN_REPAYMENT', 'staff_loans', loanId, { staff_id: loan.staff_id, amount, remaining: newBalance }, req.ip);
    res.json({ message: newBalance <= 0 ? 'Loan fully repaid' : 'Repayment recorded', remaining_balance: newBalance });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.cancelLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const [loan] = await query('SELECT * FROM staff_loans WHERE loan_id = ?', [loanId]);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ message: 'Only active loans can be cancelled' });

    await query('UPDATE staff_loans SET status = ? WHERE loan_id = ?', ['cancelled', loanId]);
    await logAction(req.user.user_id, req.user.name, 'LOAN_CANCELLED', 'staff_loans', loanId, { staff_id: loan.staff_id }, req.ip);
    res.json({ message: 'Loan cancelled' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLoanRepayments = async (req, res) => {
  try {
    const { loanId } = req.params;
    const repayments = await query(
      'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY repayment_date DESC', [loanId]
    );
    res.json({ data: repayments });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== SALARY INCREMENTS ==============

exports.getIncrements = async (req, res) => {
  try {
    const { staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT i.*, s.full_name, s.employee_id, s.department, u.name as approved_by_name
               FROM salary_increments i
               JOIN staff s ON i.staff_id = s.staff_id
               LEFT JOIN users u ON i.approved_by = u.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM salary_increments WHERE 1=1';
    const params = [], countParams = [];

    if (staff_id) { sql += ' AND i.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY i.effective_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [increments, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: increments, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createIncrement = async (req, res) => {
  const conn = await getConnection();
  try {
    const { staff_id, new_salary, effective_date, reason } = req.body;
    if (!staff_id || !new_salary || !effective_date) return res.status(400).json({ message: 'Staff, new salary and effective date required' });
    if (Number(new_salary) < 0) return res.status(400).json({ message: 'Salary cannot be negative', field: 'new_salary' });

    await conn.beginTransaction();

    const [staff] = await conn.query('SELECT staff_id, full_name, salary FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) { await conn.rollback(); return res.status(404).json({ message: 'Staff not found' }); }

    const oldSalary = Number(staff.salary || 0);
    const newSal = Number(new_salary);
    const incrementAmount = newSal - oldSalary;
    const incrementPercentage = oldSalary > 0 ? ((incrementAmount / oldSalary) * 100) : 0;

    await conn.query(
      'INSERT INTO salary_increments (staff_id, old_salary, new_salary, increment_amount, increment_percentage, effective_date, reason, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [staff_id, oldSalary, newSal, incrementAmount, incrementPercentage.toFixed(2), effective_date, reason || null, req.user.user_id]
    );

    // Update staff salary
    await conn.query('UPDATE staff SET salary = ? WHERE staff_id = ?', [newSal, staff_id]);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'SALARY_INCREMENT', 'salary_increments', staff_id, { old_salary: oldSalary, new_salary: newSal, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Salary increment applied', old_salary: oldSalary, new_salary: newSal, increment_amount: incrementAmount });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== PAYROLL PROCESSING ==============

exports.getPayrollPreview = async (req, res) => {
  try {
    const { from_date, to_date, payment_date, department } = req.query;
    if (!from_date || !to_date || !payment_date) {
      return res.status(400).json({ message: 'from_date, to_date, and payment_date required' });
    }

    let sql = `
      SELECT s.staff_id, s.employee_id, s.full_name, s.department, s.position,
             s.salary, s.salary_type,
             COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.monthly_deduction ELSE 0 END), 0) as loan_deduction
      FROM staff s
      LEFT JOIN staff_loans l ON s.staff_id = l.staff_id AND l.status = 'active'
      WHERE s.is_active = 1 AND s.salary IS NOT NULL AND s.salary > 0
    `;
    const params = [];
    if (department) { sql += ' AND s.department = ?'; params.push(department); }
    sql += ' GROUP BY s.staff_id ORDER BY s.full_name';

    const staff = await query(sql, params);

    const preview = staff.map(s => {
      const baseSalary = Number(s.salary || 0);
      const loanDeduction = Number(s.loan_deduction || 0);
      const netSalary = baseSalary - loanDeduction;

      return {
        staff_id: s.staff_id,
        employee_id: s.employee_id,
        full_name: s.full_name,
        department: s.department,
        position: s.position,
        salary_type: s.salary_type,
        base_salary: baseSalary,
        deductions: loanDeduction,
        bonuses: 0,
        net_amount: netSalary,
        payment_date,
        from_date,
        to_date
      };
    });

    const totals = preview.reduce((acc, p) => ({
      count: acc.count + 1,
      total_base: acc.total_base + p.base_salary,
      total_deductions: acc.total_deductions + p.deductions,
      total_net: acc.total_net + p.net_amount
    }), { count: 0, total_base: 0, total_deductions: 0, total_net: 0 });

    res.json({ preview, totals });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.processPayroll = async (req, res) => {
  const conn = await getConnection();
  try {
    const { payments } = req.body;
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ message: 'Payments array required' });
    }

    await conn.beginTransaction();

    let successCount = 0;
    const errors = [];

    for (const payment of payments) {
      try {
        const { staff_id, payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, notes } = payment;

        if (!staff_id || !payment_date || !from_date || !to_date || amount === undefined || net_amount === undefined) {
          errors.push({ staff_id, error: 'Missing required fields' });
          continue;
        }

        const expectedNet = Number(amount) - Number(deductions || 0) + Number(bonuses || 0);
        if (Math.abs(expectedNet - Number(net_amount)) > 0.01) {
          errors.push({ staff_id, error: 'Net amount calculation mismatch' });
          continue;
        }

        await conn.query(
          'INSERT INTO salary_payments (staff_id, payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [staff_id, payment_date, from_date, to_date, amount, deductions || 0, bonuses || 0, net_amount, 'bank_transfer', notes || 'Bulk payroll processing', req.user.user_id]
        );

        successCount++;
      } catch (err) {
        errors.push({ staff_id: payment.staff_id, error: err.message });
      }
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PAYROLL_PROCESSED', 'salary_payments', null, { count: successCount }, req.ip);

    res.json({ message: `Payroll processed: ${successCount} payments recorded`, successCount, errors });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== ADVANCE SALARY ==============

exports.getAdvancePayments = async (req, res) => {
  try {
    const { staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT a.*, s.full_name, s.employee_id, s.department
               FROM advance_payments a
               JOIN staff s ON a.staff_id = s.staff_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM advance_payments WHERE 1=1';
    const params = [], countParams = [];

    if (staff_id) { sql += ' AND a.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY a.payment_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [advances, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: advances, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAdvancePayment = async (req, res) => {
  try {
    const { staff_id, amount, payment_date, reason, payment_method } = req.body;
    if (!staff_id || !amount || !payment_date) return res.status(400).json({ message: 'Staff, amount and date required' });
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive', field: 'amount' });

    const [staff] = await query('SELECT full_name FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const result = await query(
      'INSERT INTO advance_payments (staff_id, amount, payment_date, payment_method, reason, paid_by) VALUES (?, ?, ?, ?, ?, ?)',
      [staff_id, amount, payment_date, payment_method || 'cash', reason || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'ADVANCE_PAYMENT', 'advance_payments', result.insertId, { staff_id, amount, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Advance payment recorded', advance_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== HOLIDAY CALENDAR ==============

exports.getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    let sql = 'SELECT * FROM holidays';
    const params = [];
    if (year) { sql += ' WHERE YEAR(holiday_date) = ?'; params.push(year); }
    sql += ' ORDER BY holiday_date ASC';

    const holidays = await query(sql, params);
    res.json({ data: holidays });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createHoliday = async (req, res) => {
  try {
    const { holiday_date, holiday_name, description } = req.body;
    if (!holiday_date || !holiday_name) return res.status(400).json({ message: 'Date and name required' });

    const result = await query(
      'INSERT INTO holidays (holiday_date, holiday_name, description, created_by) VALUES (?, ?, ?, ?)',
      [holiday_date, holiday_name, description || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'HOLIDAY_CREATED', 'holidays', result.insertId, { holiday_name, holiday_date }, req.ip);
    res.status(201).json({ message: 'Holiday created', holiday_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { holiday_date, holiday_name, description } = req.body;
    if (!holiday_date || !holiday_name) return res.status(400).json({ message: 'Date and name required' });

    await query(
      'UPDATE holidays SET holiday_date=?, holiday_name=?, description=? WHERE holiday_id=?',
      [holiday_date, holiday_name, description || null, id]
    );

    await logAction(req.user.user_id, req.user.name, 'HOLIDAY_UPDATED', 'holidays', id, { holiday_name }, req.ip);
    res.json({ message: 'Holiday updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM holidays WHERE holiday_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'HOLIDAY_DELETED', 'holidays', id, {}, req.ip);
    res.json({ message: 'Holiday deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== LEAVE REQUESTS ==============

exports.getLeaveRequests = async (req, res) => {
  try {
    const { status, staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT lr.*, s.full_name, s.employee_id, s.department,
               u1.name as requested_by_name, u2.name as reviewed_by_name
               FROM leave_requests lr
               JOIN staff s ON lr.staff_id = s.staff_id
               LEFT JOIN users u1 ON lr.requested_by = u1.user_id
               LEFT JOIN users u2 ON lr.reviewed_by = u2.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM leave_requests WHERE 1=1';
    const params = [], countParams = [];

    if (status) { sql += ' AND lr.status = ?'; countSql += ' AND status = ?'; params.push(status); countParams.push(status); }
    if (staff_id) { sql += ' AND lr.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [requests, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: requests, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createLeaveRequest = async (req, res) => {
  try {
    const { staff_id, leave_type, from_date, to_date, reason } = req.body;
    if (!staff_id || !leave_type || !from_date || !to_date) return res.status(400).json({ message: 'All fields required' });
    if (new Date(from_date) > new Date(to_date)) return res.status(400).json({ message: 'From date must be before to date', field: 'from_date' });

    const [staff] = await query('SELECT full_name, leave_balance FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const days = Math.ceil((new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24)) + 1;

    const result = await query(
      'INSERT INTO leave_requests (staff_id, leave_type, from_date, to_date, days, reason, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [staff_id, leave_type, from_date, to_date, days, reason || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'LEAVE_REQUESTED', 'leave_requests', result.insertId, { staff_id, days, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Leave request submitted', request_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const [request] = await query('SELECT * FROM leave_requests WHERE request_id = ?', [id]);
    if (!request) return res.status(404).json({ message: 'Leave request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be reviewed' });

    await query(
      'UPDATE leave_requests SET status=?, review_notes=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE request_id=?',
      [status, review_notes || null, req.user.user_id, id]
    );

    // Deduct leave balance when approved
    if (status === 'approved' && request.leave_type !== 'unpaid') {
      await query('UPDATE staff SET leave_balance = GREATEST(leave_balance - ?, 0) WHERE staff_id = ?', [request.days, request.staff_id]);
    }

    await logAction(req.user.user_id, req.user.name, `LEAVE_${status.toUpperCase()}`, 'leave_requests', id, { staff_id: request.staff_id, days: request.days }, req.ip);
    res.json({ message: `Leave request ${status}` });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== DEPARTMENTS ==============

exports.getDepartments = async (req, res) => {
  try {
    const { is_active } = req.query;
    let sql = 'SELECT * FROM departments WHERE 1=1';
    const params = [];
    if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active); }
    sql += ' ORDER BY department_name ASC';
    const depts = await query(sql, params);
    res.json({ data: depts });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, description, head_of_dept } = req.body;
    if (!name) return res.status(400).json({ message: 'Department name required' });
    const result = await query(
      'INSERT INTO departments (name, description, head_of_dept) VALUES (?, ?, ?)',
      [name, description || null, head_of_dept || null]
    );
    await logAction(req.user.user_id, req.user.name, 'DEPT_CREATED', 'departments', result.insertId, { name }, req.ip);
    res.status(201).json({ message: 'Department created', department_id: result.insertId });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Department name already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, head_of_dept, is_active } = req.body;
    if (!name) return res.status(400).json({ message: 'Department name required' });
    await query(
      'UPDATE departments SET name=?, description=?, head_of_dept=?, is_active=? WHERE department_id=?',
      [name, description || null, head_of_dept || null, is_active ?? 1, id]
    );
    await logAction(req.user.user_id, req.user.name, 'DEPT_UPDATED', 'departments', id, { name }, req.ip);
    res.json({ message: 'Department updated' });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Department name already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const [dept] = await query('SELECT name FROM departments WHERE department_id = ?', [id]);
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    const [{ count }] = await query('SELECT COUNT(*) as count FROM staff WHERE department = ? AND is_active = 1', [dept.name]);
    if (Number(count) > 0) return res.status(400).json({ message: `Cannot delete — ${count} active staff in this department` });
    await query('DELETE FROM departments WHERE department_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'DEPT_DELETED', 'departments', id, { name: dept.name }, req.ip);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== DESIGNATIONS ==============

exports.getDesignations = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { department_id, is_active } = req.query;
    let sql = `SELECT d.*, dept.department_name
               FROM designations d
               LEFT JOIN departments dept ON d.department_id = dept.department_id
               WHERE 1=1`;
    const params = [];
    if (department_id) { sql += ' AND d.department_id = ?'; params.push(department_id); }
    if (is_active !== undefined) { sql += ' AND d.is_active = ?'; params.push(is_active); }
    sql += ' ORDER BY d.name ASC';
    res.json({ data: await query(sql, params) });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createDesignation = async (req, res) => {
  try {
    await ensureTablesAndColumns();
    const { name, department_id, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Designation name required' });
    const result = await query(
      'INSERT INTO designations (name, department_id, description) VALUES (?, ?, ?)',
      [name.trim(), department_id || null, description || null]
    );
    await logAction(req.user.user_id, req.user.name, 'DESIGNATION_CREATED', 'designations', result.insertId, { name }, req.ip);
    res.status(201).json({ message: 'Designation created', designation_id: result.insertId });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Designation name already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department_id, description, is_active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Designation name required' });
    await query(
      'UPDATE designations SET name=?, department_id=?, description=?, is_active=? WHERE designation_id=?',
      [name.trim(), department_id || null, description || null, is_active ?? 1, id]
    );
    await logAction(req.user.user_id, req.user.name, 'DESIGNATION_UPDATED', 'designations', id, { name }, req.ip);
    res.json({ message: 'Designation updated' });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Designation name already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const [desig] = await query('SELECT name FROM designations WHERE designation_id = ?', [id]);
    if (!desig) return res.status(404).json({ message: 'Designation not found' });
    const [{ count }] = await query('SELECT COUNT(*) as count FROM staff WHERE position = ? AND is_active = 1', [desig.name]);
    if (Number(count) > 0) return res.status(400).json({ message: `Cannot delete — ${count} active staff have this designation` });
    await query('DELETE FROM designations WHERE designation_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'DESIGNATION_DELETED', 'designations', id, { name: desig.name }, req.ip);
    res.json({ message: 'Designation deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== SALARY COMPONENTS ==============

exports.getSalaryComponents = async (req, res) => {
  try {
    const components = await query('SELECT * FROM salary_components ORDER BY type, name');
    res.json({ data: components });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createSalaryComponent = async (req, res) => {
  try {
    const { name, type, calculation, default_value, is_taxable } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type required' });
    const result = await query(
      'INSERT INTO salary_components (name, type, calculation, default_value, is_taxable) VALUES (?,?,?,?,?)',
      [name, type, calculation || 'fixed', default_value || 0, is_taxable ? 1 : 0]
    );
    await logAction(req.user.user_id, req.user.name, 'SALARY_COMPONENT_CREATED', 'salary_components', result.insertId, { name, type }, req.ip);
    res.status(201).json({ message: 'Component created', component_id: result.insertId });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Component name already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSalaryComponent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, calculation, default_value, is_taxable, is_active } = req.body;
    if (!name || !type) return res.status(400).json({ message: 'Name and type required' });
    await query(
      'UPDATE salary_components SET name=?, type=?, calculation=?, default_value=?, is_taxable=?, is_active=? WHERE component_id=?',
      [name, type, calculation || 'fixed', default_value || 0, is_taxable ? 1 : 0, is_active ?? 1, id]
    );
    res.json({ message: 'Component updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteSalaryComponent = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM salary_components WHERE component_id = ?', [id]);
    res.json({ message: 'Component deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStaffComponents = async (req, res) => {
  try {
    const { staffId } = req.params;
    const rows = await query(`
      SELECT sc.*, COALESCE(ssc.custom_value, sc.default_value) as effective_value, ssc.is_active as staff_active
      FROM salary_components sc
      LEFT JOIN staff_salary_components ssc ON sc.component_id = ssc.component_id AND ssc.staff_id = ?
      WHERE sc.is_active = 1
      ORDER BY sc.type, sc.name
    `, [staffId]);
    res.json({ data: rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.saveStaffComponents = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { components } = req.body;
    if (!Array.isArray(components)) return res.status(400).json({ message: 'components array required' });

    for (const c of components) {
      await query(`
        INSERT INTO staff_salary_components (staff_id, component_id, custom_value, is_active)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE custom_value=?, is_active=?
      `, [staffId, c.component_id, c.custom_value ?? null, c.is_active ? 1 : 0, c.custom_value ?? null, c.is_active ? 1 : 0]);
    }
    res.json({ message: 'Staff components saved' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== SHIFTS ==============

exports.getShifts = async (req, res) => {
  try {
    const shifts = await query('SELECT * FROM shifts ORDER BY name');
    res.json({ data: shifts });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createShift = async (req, res) => {
  try {
    const { name, start_time, end_time, grace_minutes, is_overnight } = req.body;
    if (!name || !start_time || !end_time) return res.status(400).json({ message: 'Name, start and end time required' });
    const result = await query(
      'INSERT INTO shifts (name, start_time, end_time, grace_minutes, is_overnight) VALUES (?,?,?,?,?)',
      [name, start_time, end_time, grace_minutes || 15, is_overnight ? 1 : 0]
    );
    await logAction(req.user.user_id, req.user.name, 'SHIFT_CREATED', 'shifts', result.insertId, { name }, req.ip);
    res.status(201).json({ message: 'Shift created', shift_id: result.insertId });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Shift name already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_time, end_time, grace_minutes, is_overnight, is_active } = req.body;
    if (!name || !start_time || !end_time) return res.status(400).json({ message: 'Name, start and end time required' });
    await query(
      'UPDATE shifts SET name=?, start_time=?, end_time=?, grace_minutes=?, is_overnight=?, is_active=? WHERE shift_id=?',
      [name, start_time, end_time, grace_minutes || 15, is_overnight ? 1 : 0, is_active ?? 1, id]
    );
    res.json({ message: 'Shift updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const [{ count }] = await query('SELECT COUNT(*) as count FROM staff WHERE shift_id = ? AND is_active = 1', [id]);
    if (Number(count) > 0) return res.status(400).json({ message: `Cannot delete — ${count} staff assigned to this shift` });
    await query('DELETE FROM shifts WHERE shift_id = ?', [id]);
    res.json({ message: 'Shift deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== PERFORMANCE APPRAISALS ==============

exports.getAppraisals = async (req, res) => {
  try {
    const { staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT a.*, s.full_name, s.employee_id, s.department, u.name as appraised_by_name
               FROM performance_appraisals a
               JOIN staff s ON a.staff_id = s.staff_id
               LEFT JOIN users u ON a.appraised_by = u.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM performance_appraisals WHERE 1=1';
    const params = [], countParams = [];

    if (staff_id) { sql += ' AND a.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }
    sql += ' ORDER BY a.appraisal_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [appraisals, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: appraisals, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAppraisal = async (req, res) => {
  try {
    const { staff_id, appraisal_date, period_from, period_to, rating, goals_achieved, strengths, improvements, overall_comments } = req.body;
    if (!staff_id || !appraisal_date || !rating) return res.status(400).json({ message: 'Staff, date and rating required' });

    const [staff] = await query('SELECT full_name FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const result = await query(
      'INSERT INTO performance_appraisals (staff_id, appraisal_date, period_from, period_to, rating, goals_achieved, strengths, improvements, overall_comments, appraised_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [staff_id, appraisal_date, period_from || null, period_to || null, rating, goals_achieved || null, strengths || null, improvements || null, overall_comments || null, req.user.user_id]
    );
    await logAction(req.user.user_id, req.user.name, 'APPRAISAL_CREATED', 'performance_appraisals', result.insertId, { staff_id, rating, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Appraisal created', appraisal_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateAppraisal = async (req, res) => {
  try {
    const { id } = req.params;
    const { appraisal_date, period_from, period_to, rating, goals_achieved, strengths, improvements, overall_comments } = req.body;
    if (!appraisal_date || !rating) return res.status(400).json({ message: 'Date and rating required' });
    await query(
      'UPDATE performance_appraisals SET appraisal_date=?, period_from=?, period_to=?, rating=?, goals_achieved=?, strengths=?, improvements=?, overall_comments=? WHERE appraisal_id=?',
      [appraisal_date, period_from || null, period_to || null, rating, goals_achieved || null, strengths || null, improvements || null, overall_comments || null, id]
    );
    res.json({ message: 'Appraisal updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAppraisal = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM performance_appraisals WHERE appraisal_id = ?', [id]);
    res.json({ message: 'Appraisal deleted' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== EXIT MANAGEMENT ==============

exports.getExitRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT e.*, s.full_name, s.employee_id, s.department, s.position,
               u.name as reviewed_by_name
               FROM exit_requests e
               JOIN staff s ON e.staff_id = s.staff_id
               LEFT JOIN users u ON e.reviewed_by = u.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM exit_requests WHERE 1=1';
    const params = [], countParams = [];

    if (status) { sql += ' AND e.status = ?'; countSql += ' AND status = ?'; params.push(status); countParams.push(status); }
    sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [exits, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: exits, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createExitRequest = async (req, res) => {
  try {
    const { staff_id, exit_type, notice_date, last_working_date, reason, final_settlement, settlement_notes } = req.body;
    if (!staff_id || !exit_type || !notice_date) return res.status(400).json({ message: 'Staff, type and notice date required' });

    const [staff] = await query('SELECT full_name FROM staff WHERE staff_id = ? AND is_active = 1', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Active staff not found' });

    // Check no pending exit exists
    const [existing] = await query('SELECT exit_id FROM exit_requests WHERE staff_id = ? AND status IN ("pending","approved")', [staff_id]);
    if (existing) return res.status(400).json({ message: 'Staff already has a pending/approved exit request' });

    const result = await query(
      'INSERT INTO exit_requests (staff_id, exit_type, notice_date, last_working_date, reason, final_settlement, settlement_notes) VALUES (?,?,?,?,?,?,?)',
      [staff_id, exit_type, notice_date, last_working_date || null, reason || null, final_settlement || 0, settlement_notes || null]
    );
    await logAction(req.user.user_id, req.user.name, 'EXIT_REQUESTED', 'exit_requests', result.insertId, { staff_id, exit_type, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Exit request created', exit_id: result.insertId });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewExitRequest = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const { status, review_notes, final_settlement } = req.body;
    if (!status || !['approved', 'rejected', 'completed'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const [exit] = await query('SELECT * FROM exit_requests WHERE exit_id = ?', [id]);
    if (!exit) return res.status(404).json({ message: 'Exit request not found' });

    await conn.beginTransaction();

    await conn.query(
      'UPDATE exit_requests SET status=?, review_notes=?, reviewed_by=?, final_settlement=COALESCE(?,final_settlement) WHERE exit_id=?',
      [status, review_notes || null, req.user.user_id, final_settlement ?? null, id]
    );

    // Deactivate staff on approved or completed
    if (status === 'approved' || status === 'completed') {
      await conn.query('UPDATE staff SET is_active = 0 WHERE staff_id = ?', [exit.staff_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, `EXIT_${status.toUpperCase()}`, 'exit_requests', id, { staff_id: exit.staff_id }, req.ip);
    res.json({ message: `Exit request ${status}` });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== LEAVE POLICIES ==============

exports.getLeavePolicies = async (req, res) => {
  try {
    const policies = await query('SELECT * FROM leave_policies ORDER BY leave_type');
    res.json({ data: policies });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateLeavePolicy = async (req, res) => {
  try {
    const { leave_type } = req.params;
    const { annual_entitlement, carry_forward_allowed, max_carry_forward, accrual_type } = req.body;
    await query(
      'UPDATE leave_policies SET annual_entitlement=?, carry_forward_allowed=?, max_carry_forward=?, accrual_type=? WHERE leave_type=?',
      [annual_entitlement || 0, carry_forward_allowed ? 1 : 0, max_carry_forward || 0, accrual_type || 'yearly', leave_type]
    );
    res.json({ message: 'Policy updated' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Apply leave carry-forward at year end
exports.processLeaveCarryForward = async (req, res) => {
  const conn = await getConnection();
  try {
    const policies = await query('SELECT * FROM leave_policies WHERE carry_forward_allowed = 1');
    const staff = await query('SELECT staff_id, leave_balance FROM staff WHERE is_active = 1');

    await conn.beginTransaction();
    let processed = 0;
    for (const s of staff) {
      const annualPolicy = policies.find(p => p.leave_type === 'annual');
      if (!annualPolicy) continue;
      const carry = Math.min(Number(s.leave_balance), Number(annualPolicy.max_carry_forward));
      const newBalance = Number(annualPolicy.annual_entitlement) + carry;
      await conn.query('UPDATE staff SET leave_balance = ? WHERE staff_id = ?', [newBalance, s.staff_id]);
      processed++;
    }
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'LEAVE_CARRY_FORWARD', 'staff', null, { staff_count: processed }, req.ip);
    res.json({ message: `Leave carry-forward processed for ${processed} staff`, processed });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};
