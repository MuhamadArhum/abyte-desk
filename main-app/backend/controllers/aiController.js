// =============================================================
// aiController.js - AI Chat Assistant (Ollama / local model)
// Compact context to stay within CPU-friendly token limits.
// =============================================================

const logger = require('../config/logger');
const { query } = require("../config/database");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'llama3.2';

const sq = async (sql, params = []) => {
  try { return await query(sql, params); }
  catch (e) { logger.error('[AI query error]', { error: e.message.slice(0, 120) }); return []; }
};

// ── Context cache: 2 min TTL ───────────────────────────────────
const contextCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCachedContext(tenantDb) {
  const cached = contextCache.get(tenantDb);
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) return cached.context;
  return null;
}

// ── Build COMPACT context (summaries only, no large lists) ────
async function getSystemContext(tenantDb) {
  const cached = getCachedContext(tenantDb);
  if (cached) return cached;

  try {
    const [
      salesToday, salesYesterday, salesThisMonth, salesLastMonth,
      topProducts, salesByCategory, recentSales,
      stockSummary, inventoryValue, lowStockCount,
      lowStock, purchaseOrders,
      customersSummary, topCustomers, creditDues,
      attendanceToday, salaryThisMonth,
      bankAccounts, registerStatus,
    ] = await Promise.all([

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(profit),0) as profit
          FROM sales WHERE DATE(sale_date)=CURDATE() AND status!='refunded'`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(profit),0) as profit
          FROM sales WHERE DATE(sale_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY) AND status!='refunded'`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(profit),0) as profit
          FROM sales WHERE YEAR(sale_date)=YEAR(CURDATE()) AND MONTH(sale_date)=MONTH(CURDATE()) AND status!='refunded'`),

      sq(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(profit),0) as profit
          FROM sales WHERE YEAR(sale_date)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))
            AND MONTH(sale_date)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND status!='refunded'`),

      sq(`SELECT p.product_name, SUM(sd.quantity) as qty, SUM(sd.total_price) as rev
          FROM sale_details sd JOIN products p ON sd.product_id=p.product_id
          JOIN sales s ON sd.sale_id=s.sale_id
          WHERE YEAR(s.sale_date)=YEAR(CURDATE()) AND MONTH(s.sale_date)=MONTH(CURDATE())
          GROUP BY p.product_id ORDER BY qty DESC LIMIT 5`),

      sq(`SELECT cat.category_name, SUM(sd.total_price) as rev
          FROM sale_details sd JOIN products p ON sd.product_id=p.product_id
          JOIN categories cat ON p.category_id=cat.category_id
          JOIN sales s ON sd.sale_id=s.sale_id
          WHERE YEAR(s.sale_date)=YEAR(CURDATE()) AND MONTH(s.sale_date)=MONTH(CURDATE())
          GROUP BY cat.category_id ORDER BY rev DESC LIMIT 5`),

      sq(`SELECT COALESCE(c.customer_name,'Walk-in') as customer, s.total_amount, s.payment_method,
               DATE_FORMAT(s.sale_date,'%Y-%m-%d') as date
          FROM sales s LEFT JOIN customers c ON s.customer_id=c.customer_id
          ORDER BY s.sale_date DESC LIMIT 8`),

      sq(`SELECT COUNT(*) as total_products, COALESCE(SUM(i.available_stock),0) as total_units,
               COUNT(CASE WHEN i.available_stock=0 THEN 1 END) as out_of_stock
          FROM inventory i JOIN products p ON i.product_id=p.product_id WHERE p.is_active=1`),

      sq(`SELECT COALESCE(SUM(i.available_stock*p.cost_price),0) as stock_value
          FROM inventory i JOIN products p ON i.product_id=p.product_id WHERE p.is_active=1`),

      sq(`SELECT COUNT(*) as low FROM inventory i JOIN products p ON i.product_id=p.product_id
          WHERE i.available_stock<=COALESCE(p.reorder_level,10) AND p.is_active=1`),

      sq(`SELECT p.product_name, i.available_stock as stock
          FROM inventory i JOIN products p ON i.product_id=p.product_id
          WHERE i.available_stock<=COALESCE(p.reorder_level,10) AND p.is_active=1
          ORDER BY i.available_stock ASC LIMIT 8`),

      sq(`SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('pending','ordered','partial') THEN 1 ELSE 0 END) as pending
          FROM purchase_orders`),

      sq(`SELECT COUNT(*) as total FROM customers WHERE customer_id!=1`),

      sq(`SELECT c.customer_name, COALESCE(SUM(s.total_amount),0) as spent
          FROM sales s JOIN customers c ON s.customer_id=c.customer_id
          WHERE c.customer_id!=1 AND YEAR(s.sale_date)=YEAR(CURDATE()) AND MONTH(s.sale_date)=MONTH(CURDATE())
          GROUP BY c.customer_id ORDER BY spent DESC LIMIT 5`),

      sq(`SELECT c.customer_name, cs.balance_due
          FROM credit_sales cs JOIN customers c ON cs.customer_id=c.customer_id
          WHERE cs.status IN ('pending','partial') ORDER BY cs.balance_due DESC LIMIT 5`),

      sq(`SELECT SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
               SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent, COUNT(*) as total
          FROM attendance WHERE DATE(check_in)=CURDATE()`),

      sq(`SELECT COALESCE(SUM(net_amount),0) as total, COUNT(*) as count
          FROM salary_payments WHERE YEAR(payment_date)=YEAR(CURDATE()) AND MONTH(payment_date)=MONTH(CURDATE())`),

      sq(`SELECT bank_name, current_balance FROM bank_accounts WHERE is_active=1`),

      sq(`SELECT status, opening_balance FROM cash_registers ORDER BY register_id DESC LIMIT 1`),
    ]);

    const t  = salesToday[0]      || { count:0, total:0, profit:0 };
    const y  = salesYesterday[0]  || { count:0, total:0, profit:0 };
    const tm = salesThisMonth[0]  || { count:0, total:0, profit:0 };
    const lm = salesLastMonth[0]  || { count:0, total:0, profit:0 };
    const st = stockSummary[0]    || { total_products:0, total_units:0, out_of_stock:0 };
    const iv = inventoryValue[0]  || { stock_value:0 };
    const ls = lowStockCount[0]   || { low:0 };
    const po = purchaseOrders[0]  || { total:0, pending:0 };
    const cu = customersSummary[0]|| { total:0 };
    const at = attendanceToday[0] || { present:0, absent:0, total:0 };
    const sl = salaryThisMonth[0] || { total:0, count:0 };
    const reg = registerStatus[0];

    const ctx = `=== AByte ERP Live Data — ${new Date().toLocaleDateString('en-PK')} ${new Date().toLocaleTimeString('en-PK')} ===

SALES:
Today: ${t.count} sales, Rs.${Number(t.total).toLocaleString()}, Profit Rs.${Number(t.profit).toLocaleString()}
Yesterday: ${y.count} sales, Rs.${Number(y.total).toLocaleString()}, Profit Rs.${Number(y.profit).toLocaleString()}
This month: ${tm.count} sales, Rs.${Number(tm.total).toLocaleString()}, Profit Rs.${Number(tm.profit).toLocaleString()}
Last month: ${lm.count} sales, Rs.${Number(lm.total).toLocaleString()}, Profit Rs.${Number(lm.profit).toLocaleString()}

Recent sales: ${recentSales.map(s=>`${s.date} ${s.customer} Rs.${s.total_amount} ${s.payment_method}`).join(' | ')}

Top products this month: ${topProducts.map((p,i)=>`${i+1}.${p.product_name}(${p.qty}units Rs.${Number(p.rev).toLocaleString()})`).join(', ')||'none'}
Top categories: ${salesByCategory.map(c=>`${c.category_name} Rs.${Number(c.rev).toLocaleString()}`).join(', ')||'none'}

INVENTORY:
${st.total_products} products, ${Number(st.total_units).toLocaleString()} units, ${st.out_of_stock} out-of-stock, ${ls.low} low-stock
Stock value: Rs.${Number(iv.stock_value).toLocaleString()}
Purchase orders: ${po.total} total, ${po.pending} pending
Low stock items: ${lowStock.map(i=>`${i.product_name}(${i.stock})`).join(', ')||'none'}

CUSTOMERS:
Total: ${cu.total}
Top this month: ${topCustomers.map((c,i)=>`${i+1}.${c.customer_name} Rs.${Number(c.spent).toLocaleString()}`).join(', ')||'none'}
Credit dues: ${creditDues.map(c=>`${c.customer_name} Rs.${Number(c.balance_due).toLocaleString()}`).join(', ')||'none'}

HR:
Attendance today: ${at.present} present, ${at.absent} absent (${at.total} total)
Salary this month: Rs.${Number(sl.total).toLocaleString()} for ${sl.count} staff

ACCOUNTS:
Bank: ${bankAccounts.map(b=>`${b.bank_name} Rs.${Number(b.current_balance).toLocaleString()}`).join(', ')||'none'}
Register: ${reg ? `${reg.status} opening Rs.${reg.opening_balance}` : 'no data'}
=== END ===`;

    contextCache.set(tenantDb, { context: ctx, builtAt: Date.now() });
    return ctx;

  } catch (error) {
    logger.error('AI context build error', { error: error.message });
    return `=== AByte ERP ===\nDate: ${new Date().toLocaleDateString()}\nData temporarily unavailable.\n===`;
  }
}

// ── Chat endpoint ──────────────────────────────────────────────
exports.chat = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0)
      return res.status(400).json({ error: 'Message is required' });
    if (message.length > 2000)
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });

    const tenantDb = process.env.DB_NAME || 'abyte_pos';
    const systemContext = await getSystemContext(tenantDb);

    const messages = [
      {
        role: 'system',
        content: `You are AByte ERP Business Assistant. You help business owners understand their shop data.

IMPORTANT RULES:
- Answer ONLY from the DATA PROVIDED below. Do NOT make up numbers.
- If asked about today's sales, use "SALES > Today" line from the data.
- Be short and direct. Max 5-6 lines.
- You can reply in English or Roman Urdu (whichever the user uses).
- Never mention stock exchanges, trading platforms, or investments.`
      },
      {
        role: 'user',
        content: `Here is my current business data:\n\n${systemContext}\n\nPlease remember this data to answer my questions.`
      },
      {
        role: 'assistant',
        content: `Understood! I have your live business data loaded. Ask me anything about your sales, inventory, customers, staff, or accounts.`
      }
    ];

    if (history && Array.isArray(history)) {
      history.slice(-4).forEach(msg => {
        if (msg.role && msg.parts?.[0]) {
          messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts[0].text
          });
        }
      });
    }

    messages.push({ role: 'user', content: message });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let ollamaRes;
    try {
      ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages,
          stream: false,
          options: { temperature: 0.3, num_predict: 400, num_ctx: 2048 },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text().catch(() => '');
      logger.error('Ollama error', { status: ollamaRes.status, body: text.slice(0, 200) });
      if (ollamaRes.status === 404)
        return res.status(503).json({ error: `Model "${OLLAMA_MODEL}" not found. Run: ollama pull ${OLLAMA_MODEL}` });
      return res.status(503).json({ error: 'AI assistant is temporarily unavailable.' });
    }

    const data = await ollamaRes.json();
    const reply = data.message?.content;

    if (!reply) {
      logger.error('Ollama empty response', { data });
      return res.status(503).json({ error: 'AI returned empty response. Try again.' });
    }

    res.json({ reply });

  } catch (error) {
    if (error.name === 'AbortError')
      return res.status(503).json({ error: 'AI request timed out. Try again in a moment.' });
    if (error.cause?.code === 'ECONNREFUSED')
      return res.status(503).json({ error: 'Ollama is not running. Start it with: ollama serve' });
    logger.error('AI Chat Error:', error.message);
    res.status(503).json({ error: 'AI assistant is temporarily unavailable.' });
  }
};
