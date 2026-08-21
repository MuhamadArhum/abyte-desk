// =============================================================
// aiController.js - AI Chat Assistant Controller
// Full business context from ALL modules for Groq AI.
// =============================================================

const logger = require('../config/logger');
const { query } = require("../config/database");

let groq = null;
function getGroqClient() {
  if (!groq && process.env.GROQ_API_KEY) {
    const Groq = require("groq-sdk");
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

const sq = async (sql, params = []) => {
  try { return await query(sql, params); }
  catch (e) { logger.error('[AI query error]', { error: e.message.slice(0, 120) }); return []; }
};

// ── Context cache: rebuild at most once every 2 minutes per tenant ────────
const contextCache = new Map(); // key: tenantDb, value: { context, builtAt }
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCachedContext(tenantDb) {
  const cached = contextCache.get(tenantDb);
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) return cached.context;
  return null;
}

// ── Build full business context ────────────────────────────────────────────
async function getSystemContext(tenantDb) {
  const cached = getCachedContext(tenantDb);
  if (cached) return cached;
  try {
    const [
      // ── SALES ──────────────────────────────────────────────────────
      salesToday, salesYesterday, salesThisMonth, salesLastMonth,
      todaySalesDetail, yesterdaySalesDetail, recentSales,
      topProductsMonth, salesByCategory, returnsSummary,
      quotationsSummary, creditSalesSummary, deliveriesSummary,

      // ── INVENTORY ──────────────────────────────────────────────────
      allProducts, lowStock, stockSummary, inventoryValue,
      suppliersList, purchaseOrdersSummary, recentPurchaseOrders,
      stockAdjustments, stockTransfers, stockIssues,

      // ── CUSTOMERS ──────────────────────────────────────────────────
      customersSummary, topCustomers, creditCustomers, allCustomers,

      // ── HR ─────────────────────────────────────────────────────────
      staffList, attendanceToday, salaryThisMonth,
      advancePayments, activeLoans, leaveRequests, departments,

      // ── ACCOUNTS ───────────────────────────────────────────────────
      accountsList, cpvThisMonth, crvThisMonth,
      journalEntriesMonth, bankAccounts,

      // ── SYSTEM ─────────────────────────────────────────────────────
      registerStatus, usersList,

    ] = await Promise.all([

      // ════════════ SALES ════════════
      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total,
               COALESCE(SUM(profit),0) as profit, COALESCE(AVG(total_amount),0) as avg_sale
          FROM sales WHERE DATE(sale_date)=CURDATE() AND status!='refunded'`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total,
               COALESCE(SUM(profit),0) as profit
          FROM sales WHERE DATE(sale_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY) AND status!='refunded'`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total,
               COALESCE(SUM(profit),0) as profit
          FROM sales WHERE YEAR(sale_date)=YEAR(CURDATE()) AND MONTH(sale_date)=MONTH(CURDATE()) AND status!='refunded'`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total,
               COALESCE(SUM(profit),0) as profit
          FROM sales WHERE YEAR(sale_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))
            AND MONTH(sale_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND status!='refunded'`),

      sq(`SELECT s.sale_id, COALESCE(c.customer_name,'Walk-in') as customer,
               s.total_amount, s.profit, s.payment_method, s.sale_date,
               GROUP_CONCAT(CONCAT(p.product_name,' x',sd.quantity,' @Rs.',sd.unit_price)
                 ORDER BY sd.sale_detail_id SEPARATOR ' | ') as products
          FROM sales s
          LEFT JOIN customers c ON s.customer_id=c.customer_id
          LEFT JOIN sale_details sd ON s.sale_id=sd.sale_id
          LEFT JOIN products p ON sd.product_id=p.product_id
          WHERE DATE(s.sale_date)=CURDATE() AND s.status!='refunded'
          GROUP BY s.sale_id,c.customer_name,s.total_amount,s.profit,s.payment_method,s.sale_date
          ORDER BY s.sale_date DESC LIMIT 30`),

      sq(`SELECT s.sale_id, COALESCE(c.customer_name,'Walk-in') as customer,
               s.total_amount, s.profit, s.payment_method, s.sale_date,
               GROUP_CONCAT(CONCAT(p.product_name,' x',sd.quantity,' @Rs.',sd.unit_price)
                 ORDER BY sd.sale_detail_id SEPARATOR ' | ') as products
          FROM sales s
          LEFT JOIN customers c ON s.customer_id=c.customer_id
          LEFT JOIN sale_details sd ON s.sale_id=sd.sale_id
          LEFT JOIN products p ON sd.product_id=p.product_id
          WHERE DATE(s.sale_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY) AND s.status!='refunded'
          GROUP BY s.sale_id,c.customer_name,s.total_amount,s.profit,s.payment_method,s.sale_date
          ORDER BY s.sale_date DESC LIMIT 30`),

      sq(`SELECT s.sale_id, COALESCE(c.customer_name,'Walk-in') as customer,
               s.total_amount, s.payment_method, s.sale_date
          FROM sales s LEFT JOIN customers c ON s.customer_id=c.customer_id
          ORDER BY s.sale_date DESC LIMIT 10`),

      sq(`SELECT p.product_name, SUM(sd.quantity) as qty_sold, SUM(sd.subtotal) as revenue
          FROM sale_details sd
          JOIN products p ON sd.product_id=p.product_id
          JOIN sales s ON sd.sale_id=s.sale_id
          WHERE YEAR(s.sale_date)=YEAR(CURDATE()) AND MONTH(s.sale_date)=MONTH(CURDATE())
          GROUP BY p.product_id,p.product_name ORDER BY qty_sold DESC LIMIT 10`),

      sq(`SELECT cat.category_name, SUM(sd.quantity) as qty_sold, SUM(sd.subtotal) as revenue
          FROM sale_details sd
          JOIN products p ON sd.product_id=p.product_id
          JOIN categories cat ON p.category_id=cat.category_id
          JOIN sales s ON sd.sale_id=s.sale_id
          WHERE YEAR(s.sale_date)=YEAR(CURDATE()) AND MONTH(s.sale_date)=MONTH(CURDATE())
          GROUP BY cat.category_id,cat.category_name ORDER BY revenue DESC LIMIT 10`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(refund_amount),0) as total
          FROM returns WHERE YEAR(return_date)=YEAR(CURDATE()) AND MONTH(return_date)=MONTH(CURDATE())`),

      sq(`SELECT COUNT(*) as total,
               SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved
          FROM quotations`),

      sq(`SELECT COUNT(*) as total, COALESCE(SUM(total_amount),0) as outstanding
          FROM credit_sales WHERE status IN ('pending','partial')`),

      sq(`SELECT COUNT(*) as total,
               SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered
          FROM deliveries`),

      // ════════════ INVENTORY ════════════
      sq(`SELECT p.product_id, p.product_name, p.selling_price, p.cost_price,
               p.product_type, COALESCE(i.available_stock,0) as stock,
               cat.category_name
          FROM products p
          LEFT JOIN inventory i ON p.product_id=i.product_id
          LEFT JOIN categories cat ON p.category_id=cat.category_id
          WHERE p.is_active=1 ORDER BY p.product_name LIMIT 200`),

      sq(`SELECT p.product_name, i.available_stock, COALESCE(p.reorder_level,10) as reorder_level
          FROM inventory i JOIN products p ON i.product_id=p.product_id
          WHERE i.available_stock<=COALESCE(p.reorder_level,10) ORDER BY i.available_stock ASC LIMIT 20`),

      sq(`SELECT COUNT(*) as total_products, COALESCE(SUM(i.available_stock),0) as total_units,
               COUNT(CASE WHEN i.available_stock=0 THEN 1 END) as out_of_stock
          FROM inventory i JOIN products p ON i.product_id=p.product_id WHERE p.is_active=1`),

      sq(`SELECT COALESCE(SUM(i.available_stock*p.cost_price),0) as stock_value
          FROM inventory i JOIN products p ON i.product_id=p.product_id WHERE p.is_active=1`),

      sq(`SELECT supplier_id, supplier_name, phone, email, balance FROM suppliers WHERE is_active=1 ORDER BY supplier_name LIMIT 50`),

      sq(`SELECT COUNT(*) as total, COALESCE(SUM(total_amount),0) as value,
               SUM(CASE WHEN status IN ('pending','ordered','partial') THEN 1 ELSE 0 END) as pending_count,
               COALESCE(SUM(CASE WHEN status IN ('pending','ordered','partial') THEN total_amount ELSE 0 END),0) as pending_value
          FROM purchase_orders`),

      sq(`SELECT po.po_number, po.order_date, po.status, po.total_amount,
               s.supplier_name
          FROM purchase_orders po
          LEFT JOIN suppliers s ON po.supplier_id=s.supplier_id
          ORDER BY po.order_date DESC LIMIT 10`),

      sq(`SELECT COUNT(*) as count, SUM(CASE WHEN adjustment_type='add' THEN quantity ELSE -quantity END) as net_units
          FROM stock_adjustments
          WHERE YEAR(adjustment_date)=YEAR(CURDATE()) AND MONTH(adjustment_date)=MONTH(CURDATE())`),

      sq(`SELECT COUNT(*) as count FROM stock_transfers
          WHERE YEAR(transfer_date)=YEAR(CURDATE()) AND MONTH(transfer_date)=MONTH(CURDATE())`),

      sq(`SELECT COUNT(*) as total,
               SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status='issued' THEN 1 ELSE 0 END) as issued
          FROM stock_issues`),

      // ════════════ CUSTOMERS ════════════
      sq(`SELECT COUNT(*) as total,
               SUM(CASE WHEN DATE(created_at)=CURDATE() THEN 1 ELSE 0 END) as new_today,
               SUM(CASE WHEN MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE()) THEN 1 ELSE 0 END) as new_this_month
          FROM customers WHERE customer_id!=1`),

      sq(`SELECT c.customer_name, COUNT(s.sale_id) as purchases, COALESCE(SUM(s.total_amount),0) as total_spent
          FROM sales s JOIN customers c ON s.customer_id=c.customer_id
          WHERE c.customer_id!=1 AND YEAR(s.sale_date)=YEAR(CURDATE()) AND MONTH(s.sale_date)=MONTH(CURDATE())
          GROUP BY c.customer_id,c.customer_name ORDER BY total_spent DESC LIMIT 10`),

      sq(`SELECT c.customer_name, cs.total_amount, cs.paid_amount, cs.balance, cs.due_date, cs.status
          FROM credit_sales cs JOIN customers c ON cs.customer_id=c.customer_id
          WHERE cs.status IN ('pending','partial') ORDER BY cs.balance DESC LIMIT 20`),

      sq(`SELECT customer_id, customer_name, phone, email, balance FROM customers
          WHERE customer_id!=1 ORDER BY customer_name LIMIT 100`),

      // ════════════ HR ════════════
      sq(`SELECT s.staff_id, s.full_name, s.position, s.basic_salary, s.employment_status,
               d.department_name
          FROM staff s LEFT JOIN departments d ON s.department_id=d.department_id
          ORDER BY s.full_name LIMIT 100`),

      sq(`SELECT COUNT(*) as total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
               SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
               SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late
          FROM attendance WHERE DATE(date)=CURDATE()`),

      sq(`SELECT COALESCE(SUM(net_salary),0) as total, COUNT(*) as count
          FROM salary_payments
          WHERE YEAR(payment_date)=YEAR(CURDATE()) AND MONTH(payment_date)=MONTH(CURDATE())`),

      sq(`SELECT COUNT(*) as total, COALESCE(SUM(amount),0) as total_amount
          FROM advance_payments
          WHERE YEAR(payment_date)=YEAR(CURDATE()) AND MONTH(payment_date)=MONTH(CURDATE())`),

      sq(`SELECT COUNT(*) as active_loans, COALESCE(SUM(remaining_balance),0) as outstanding
          FROM staff_loans WHERE status='active'`),

      sq(`SELECT COUNT(*) as total,
               SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved
          FROM leave_requests WHERE YEAR(created_at)=YEAR(CURDATE())`),

      sq(`SELECT department_name, COUNT(s.staff_id) as staff_count
          FROM departments d LEFT JOIN staff s ON d.department_id=s.department_id
          GROUP BY d.department_id,d.department_name`),

      // ════════════ ACCOUNTS ════════════
      sq(`SELECT a.account_id, a.account_code, a.account_name, a.account_type,
               a.current_balance, a.level, g.group_name
          FROM accounts a JOIN account_groups g ON a.group_id=g.group_id
          WHERE a.is_active=1 AND a.level=4 ORDER BY a.account_code LIMIT 100`),

      sq(`SELECT pv.voucher_number, pv.voucher_date, pv.payment_to, pv.amount,
               a.account_name,
               ma.account_name as main_account_name
          FROM payment_vouchers pv
          LEFT JOIN accounts a ON pv.account_id=a.account_id
          LEFT JOIN accounts ma ON pv.main_account_id=ma.account_id
          WHERE YEAR(pv.voucher_date)=YEAR(CURDATE()) AND MONTH(pv.voucher_date)=MONTH(CURDATE())
          ORDER BY pv.voucher_date DESC LIMIT 30`),

      sq(`SELECT rv.voucher_number, rv.voucher_date, rv.received_from, rv.amount,
               a.account_name,
               ma.account_name as main_account_name
          FROM receipt_vouchers rv
          LEFT JOIN accounts a ON rv.account_id=a.account_id
          LEFT JOIN accounts ma ON rv.main_account_id=ma.account_id
          WHERE YEAR(rv.voucher_date)=YEAR(CURDATE()) AND MONTH(rv.voucher_date)=MONTH(CURDATE())
          ORDER BY rv.voucher_date DESC LIMIT 30`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(jel.debit),0) as total_debit
          FROM journal_entries je
          JOIN journal_entry_lines jel ON je.entry_id=jel.entry_id
          WHERE je.status='posted' AND YEAR(je.entry_date)=YEAR(CURDATE()) AND MONTH(je.entry_date)=MONTH(CURDATE())`),

      sq(`SELECT bank_name, account_number, account_type, current_balance FROM bank_accounts WHERE is_active=1`),

      // ════════════ SYSTEM ════════════
      sq(`SELECT status, opening_amount, closing_amount, opened_at
          FROM cash_registers ORDER BY register_id DESC LIMIT 1`),

      sq(`SELECT u.name, u.email, r.role_name FROM users u
          JOIN roles r ON u.role_id=r.role_id WHERE u.is_active=1 ORDER BY u.name`),
    ]);

    // ── Derived values ─────────────────────────────────────────────
    const today     = salesToday[0]     || { count:0, total:0, profit:0, avg_sale:0 };
    const yest      = salesYesterday[0] || { count:0, total:0, profit:0 };
    const thisMonth = salesThisMonth[0] || { count:0, total:0, profit:0 };
    const lastMonth = salesLastMonth[0] || { count:0, total:0, profit:0 };
    const stock     = stockSummary[0]   || { total_products:0, total_units:0, out_of_stock:0 };
    const invVal    = inventoryValue[0] || { stock_value:0 };
    const cust      = customersSummary[0] || { total:0, new_today:0, new_this_month:0 };
    const salary    = salaryThisMonth[0]  || { total:0, count:0 };
    const advances  = advancePayments[0]  || { total:0, total_amount:0 };
    const loans     = activeLoans[0]      || { active_loans:0, outstanding:0 };
    const leaves    = leaveRequests[0]    || { total:0, pending:0, approved:0 };
    const attToday  = attendanceToday[0]  || { total:0, present:0, absent:0, late:0 };
    const jvMonth   = journalEntriesMonth[0] || { count:0, total_debit:0 };
    const po        = purchaseOrdersSummary[0] || { total:0, value:0, pending_count:0, pending_value:0 };
    const ret       = returnsSummary[0]   || { count:0, total:0 };
    const quot      = quotationsSummary[0]|| { total:0, pending:0, approved:0 };
    const credit    = creditSalesSummary[0]|| { total:0, outstanding:0 };
    const deliv     = deliveriesSummary[0]|| { total:0, pending:0, delivered:0 };
    const adjMonth  = stockAdjustments[0] || { count:0, net_units:0 };
    const issuesSt  = stockIssues[0]      || { total:0, pending:0, issued:0 };
    const reg       = registerStatus[0];
    const registerInfo = reg
      ? `${reg.status==='open'?'OPEN':'CLOSED'} | Opening: Rs.${reg.opening_amount||0} | Opened: ${reg.opened_at ? new Date(reg.opened_at).toLocaleTimeString() : 'N/A'}`
      : 'No register data';

    const contextStr = `
=== AByte ERP — COMPLETE LIVE BUSINESS DATA ===
Date: ${new Date().toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
Time: ${new Date().toLocaleTimeString('en-PK')}

━━━━━━━━━━ SALES MODULE ━━━━━━━━━━

--- TODAY'S SALES SUMMARY ---
• Transactions: ${today.count} | Revenue: Rs. ${Number(today.total).toLocaleString()} | Profit: Rs. ${Number(today.profit).toLocaleString()} | Avg: Rs. ${Number(today.avg_sale).toFixed(0)}

--- TODAY'S TRANSACTIONS (WITH PRODUCTS) ---
${todaySalesDetail.length>0
  ? todaySalesDetail.map(s=>`• Sale #${s.sale_id} | ${s.customer} | Rs.${Number(s.total_amount).toLocaleString()} | ${s.payment_method} | ${new Date(s.sale_date).toLocaleTimeString()}\n  Items: ${s.products||'N/A'}`).join('\n')
  : '• No sales today'}

--- YESTERDAY'S SALES SUMMARY ---
• Transactions: ${yest.count} | Revenue: Rs. ${Number(yest.total).toLocaleString()} | Profit: Rs. ${Number(yest.profit).toLocaleString()}

--- YESTERDAY'S TRANSACTIONS (WITH PRODUCTS) ---
${yesterdaySalesDetail.length>0
  ? yesterdaySalesDetail.map(s=>`• Sale #${s.sale_id} | ${s.customer} | Rs.${Number(s.total_amount).toLocaleString()} | ${s.payment_method} | ${new Date(s.sale_date).toLocaleTimeString()}\n  Items: ${s.products||'N/A'}`).join('\n')
  : '• No sales yesterday'}

--- THIS MONTH SALES ---
• Transactions: ${thisMonth.count} | Revenue: Rs. ${Number(thisMonth.total).toLocaleString()} | Profit: Rs. ${Number(thisMonth.profit).toLocaleString()}

--- LAST MONTH SALES ---
• Transactions: ${lastMonth.count} | Revenue: Rs. ${Number(lastMonth.total).toLocaleString()} | Profit: Rs. ${Number(lastMonth.profit).toLocaleString()}

--- TOP 10 PRODUCTS THIS MONTH ---
${topProductsMonth.map((p,i)=>`${i+1}. ${p.product_name} — ${p.qty_sold} units — Rs.${Number(p.revenue).toLocaleString()}`).join('\n')||'• No data'}

--- SALES BY CATEGORY (THIS MONTH) ---
${salesByCategory.map(c=>`• ${c.category_name}: ${c.qty_sold} units — Rs.${Number(c.revenue).toLocaleString()}`).join('\n')||'• No data'}

--- RECENT 10 SALES ---
${recentSales.map(s=>`• #${s.sale_id} | ${s.customer} | Rs.${s.total_amount} | ${s.payment_method} | ${new Date(s.sale_date).toLocaleString()}`).join('\n')||'• None'}

--- RETURNS (THIS MONTH) ---
• Returns: ${ret.count} | Amount: Rs. ${Number(ret.total).toLocaleString()}

--- QUOTATIONS ---
• Total: ${quot.total} | Pending: ${quot.pending} | Approved: ${quot.approved}

--- CREDIT SALES ---
• Pending Credit Sales: ${credit.total} | Outstanding: Rs. ${Number(credit.outstanding).toLocaleString()}

--- CREDIT CUSTOMERS (OUTSTANDING) ---
${creditCustomers.map(c=>`• ${c.customer_name} | Total: Rs.${Number(c.total_amount).toLocaleString()} | Paid: Rs.${Number(c.paid_amount).toLocaleString()} | Balance: Rs.${Number(c.balance).toLocaleString()} | Due: ${c.due_date?new Date(c.due_date).toLocaleDateString():'N/A'}`).join('\n')||'• No credit dues'}

--- DELIVERIES ---
• Total: ${deliv.total} | Pending: ${deliv.pending} | Delivered: ${deliv.delivered}

━━━━━━━━━━ INVENTORY MODULE ━━━━━━━━━━

--- STOCK SUMMARY ---
• Total Products: ${stock.total_products} | Total Units: ${Number(stock.total_units).toLocaleString()} | Out of Stock: ${stock.out_of_stock}
• Total Stock Value: Rs. ${Number(invVal.stock_value).toLocaleString()}

--- ALL PRODUCTS (STOCK & PRICE) ---
${allProducts.map(p=>`• [${p.product_id}] ${p.product_name} | ${p.category_name||'N/A'} | Stock: ${p.stock} | Price: Rs.${p.selling_price} | Cost: Rs.${p.cost_price}`).join('\n')||'• No products'}

--- LOW/OUT OF STOCK ---
${lowStock.length>0 ? lowStock.map(i=>`• ${i.product_name}: ${i.available_stock} units (min: ${i.reorder_level})`).join('\n') : '• All products well-stocked'}

--- PURCHASE ORDERS ---
• Total: ${po.total} | Pending: ${po.pending_count} (Rs.${Number(po.pending_value).toLocaleString()})

--- RECENT PURCHASE ORDERS ---
${recentPurchaseOrders.map(p=>`• ${p.po_number} | ${p.supplier_name||'N/A'} | Rs.${Number(p.total_amount).toLocaleString()} | ${p.status} | ${new Date(p.order_date).toLocaleDateString()}`).join('\n')||'• None'}

--- SUPPLIERS ---
${suppliersList.map(s=>`• [${s.supplier_id}] ${s.supplier_name} | ${s.phone||''} | Balance: Rs.${Number(s.balance||0).toLocaleString()}`).join('\n')||'• No suppliers'}

--- STOCK MOVEMENTS (THIS MONTH) ---
• Adjustments: ${adjMonth.count} | Net Units: ${adjMonth.net_units}
• Transfers: ${stockTransfers[0]?.count||0}
• Stock Issues: Total ${issuesSt.total} | Pending ${issuesSt.pending} | Issued ${issuesSt.issued}

━━━━━━━━━━ CUSTOMERS MODULE ━━━━━━━━━━

--- CUSTOMERS SUMMARY ---
• Total: ${cust.total} | New Today: ${cust.new_today} | New This Month: ${cust.new_this_month}

--- TOP 10 CUSTOMERS (THIS MONTH) ---
${topCustomers.map((c,i)=>`${i+1}. ${c.customer_name} — ${c.purchases} purchases — Rs.${Number(c.total_spent).toLocaleString()}`).join('\n')||'• No data'}

--- ALL CUSTOMERS ---
${allCustomers.map(c=>`• [${c.customer_id}] ${c.customer_name} | ${c.phone||''} | Balance: Rs.${Number(c.balance||0).toLocaleString()}`).join('\n')||'• No customers'}

━━━━━━━━━━ HR MODULE ━━━━━━━━━━

--- ATTENDANCE TODAY ---
• Present: ${attToday.present} | Absent: ${attToday.absent} | Late: ${attToday.late} | Total: ${attToday.total}

--- ALL STAFF ---
${staffList.map(s=>`• [${s.staff_id}] ${s.full_name} | ${s.position||''} | ${s.department_name||''} | Salary: Rs.${Number(s.basic_salary||0).toLocaleString()} | ${s.employment_status}`).join('\n')||'• No staff'}

--- DEPARTMENTS ---
${departments.map(d=>`• ${d.department_name}: ${d.staff_count} staff`).join('\n')||'• No departments'}

--- SALARY (THIS MONTH) ---
• Total Paid: Rs. ${Number(salary.total).toLocaleString()} | Employees: ${salary.count}

--- ADVANCES (THIS MONTH) ---
• Count: ${advances.total} | Amount: Rs. ${Number(advances.total_amount).toLocaleString()}

--- LOANS ---
• Active Loans: ${loans.active_loans} | Outstanding: Rs. ${Number(loans.outstanding).toLocaleString()}

--- LEAVE REQUESTS (THIS YEAR) ---
• Total: ${leaves.total} | Pending: ${leaves.pending} | Approved: ${leaves.approved}

━━━━━━━━━━ ACCOUNTS MODULE ━━━━━━━━━━

--- CHART OF ACCOUNTS (LEVEL 4 - ACTIVE) ---
${accountsList.map(a=>`• [${a.account_code}] ${a.account_name} | ${a.account_type} | ${a.group_name} | Balance: Rs.${Number(a.current_balance).toLocaleString()}`).join('\n')||'• No accounts'}

--- BANK ACCOUNTS ---
${bankAccounts.map(b=>`• ${b.bank_name} | ${b.account_number} | ${b.account_type} | Balance: Rs.${Number(b.current_balance).toLocaleString()}`).join('\n')||'• No bank accounts'}

--- CPV - CASH PAYMENT VOUCHERS (THIS MONTH) ---
${cpvThisMonth.map(v=>`• ${v.voucher_number} | ${new Date(v.voucher_date).toLocaleDateString()} | ${v.payment_to} | Rs.${Number(v.amount).toLocaleString()} | Acc: ${v.account_name||''} | Main: ${v.main_account_name||''}`).join('\n')||'• No CPVs'}

--- CRV - CASH RECEIPT VOUCHERS (THIS MONTH) ---
${crvThisMonth.map(v=>`• ${v.voucher_number} | ${new Date(v.voucher_date).toLocaleDateString()} | ${v.received_from} | Rs.${Number(v.amount).toLocaleString()} | Acc: ${v.account_name||''} | Main: ${v.main_account_name||''}`).join('\n')||'• No CRVs'}

--- JOURNAL VOUCHERS (THIS MONTH) ---
• Entries: ${jvMonth.count} | Total Debit: Rs. ${Number(jvMonth.total_debit).toLocaleString()}

━━━━━━━━━━ SYSTEM ━━━━━━━━━━

--- CASH REGISTER ---
• ${registerInfo}

--- SYSTEM USERS ---
${usersList.map(u=>`• ${u.name} | ${u.email} | ${u.role_name}`).join('\n')||'• No users'}

=== END OF BUSINESS DATA ===`;

    contextCache.set(tenantDb, { context: contextStr, builtAt: Date.now() });
    return contextStr;

  } catch (error) {
    logger.error('AI context build error', { error: error.message });
    return `=== AByte ERP — PARTIAL DATA ===\nDate: ${new Date().toLocaleDateString()}\nError loading business data\n===`;
  }
}

// ── Chat endpoint ──────────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    if (!getGroqClient()) {
      return res.status(503).json({ error: 'AI feature not configured. Contact administrator.' });
    }

    const tenantDb = process.env.DB_NAME || 'abyte_pos';
    const systemContext = await getSystemContext(tenantDb);

    const messages = [
      {
        role: "system",
        content: `You are an AI Business Assistant for AByte ERP system.
You have COMPLETE real-time access to ALL business modules: Sales, Inventory, HR, Customers, Accounts, and System.

${systemContext}

Instructions:
- Answer using the exact real-time data provided above
- Support English and Urdu/Roman Urdu naturally
- Use specific numbers, names, and IDs from the data
- For transaction details, refer to the sales data with product breakdowns
- Be concise but complete — show all relevant data when asked
- You CAN answer questions about specific sales, products, staff, customers, vouchers
- Keep responses under 400 words unless a full list is requested`
      }
    ];

    if (history && Array.isArray(history)) {
      history.slice(-10).forEach(msg => {
        if (msg.role && msg.parts?.[0]) {
          messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts[0].text
          });
        }
      });
    }

    messages.push({ role: "user", content: message });

    const AI_TIMEOUT_MS = 30000;
    const MAX_RETRIES = 2;
    let completion;
    let lastErr;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      try {
        completion = await getGroqClient().chat.completions.create(
          { model: "llama-3.3-70b-versatile", messages, max_tokens: 800, temperature: 0.5 },
          { signal: controller.signal }
        );
        clearTimeout(timer);
        break;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        const isRetryable = !err.status || (err.status >= 500 && err.status < 600) || err.name === 'AbortError';
        if (!isRetryable || attempt === MAX_RETRIES) break;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!completion) {
      logger.error("AI Chat Error:", lastErr?.message);
      if (lastErr?.status === 401) return res.status(503).json({ error: "Invalid Groq API key." });
      if (lastErr?.status === 429) return res.status(503).json({ error: "Rate limit exceeded. Please wait a moment." });
      if (lastErr?.name === 'AbortError') return res.status(503).json({ error: "AI request timed out. Please try again." });
      return res.status(503).json({ error: "AI assistant is temporarily unavailable. Please try again." });
    }

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    logger.error("AI Chat Error:", error.message);
    res.status(503).json({ error: "AI assistant is temporarily unavailable. Please try again." });
  }
};
