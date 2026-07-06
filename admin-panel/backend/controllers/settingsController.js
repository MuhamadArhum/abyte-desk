const { query } = require('../config/database');
const logger = require('../config/logger');

const DEFAULTS = { sales: 2250, inventory: 2250, accounts: 2999, hr: 2999 };

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  for (const [mod, price] of Object.entries(DEFAULTS)) {
    await query('INSERT IGNORE INTO settings (`key`, value) VALUES (?, ?)', [`price_${mod}`, String(price)]);
  }
}

// GET /api/settings/prices
exports.getPrices = async (req, res) => {
  try {
    await ensureTable();
    const rows = await query("SELECT `key`, value FROM settings WHERE `key` LIKE 'price_%'");
    const prices = { ...DEFAULTS };
    rows.forEach(r => { prices[r.key.replace('price_', '')] = Number(r.value); });
    res.json({ prices });
  } catch (err) {
    logger.error('getPrices error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/settings/prices
exports.updatePrices = async (req, res) => {
  try {
    const { prices } = req.body;
    if (!prices || typeof prices !== 'object') {
      return res.status(400).json({ message: 'prices object required' });
    }
    const ALLOWED_MODULES = ['sales', 'inventory', 'accounts', 'hr'];
    for (const [mod, price] of Object.entries(prices)) {
      if (!ALLOWED_MODULES.includes(mod)) {
        return res.status(400).json({ message: `Unknown module: ${mod}` });
      }
      if (typeof price !== 'number' || price < 0 || price > 999999) {
        return res.status(400).json({ message: `Invalid price for ${mod}: must be between 0 and 999999` });
      }
      const rounded = Math.round(price * 100) / 100;
      await query(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
        [`price_${mod}`, String(rounded), String(rounded)]
      );
    }
    res.json({ message: 'Prices updated' });
  } catch (err) {
    logger.error('updatePrices error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
