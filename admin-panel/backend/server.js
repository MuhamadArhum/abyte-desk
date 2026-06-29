const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const logger       = require('./config/logger');
const authRoutes     = require('./routes/authRoutes');
const tenantRoutes   = require('./routes/tenantRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// Trust nginx reverse proxy (required for express-rate-limit behind nginx)
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5174'];

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true }));

app.get('/api/ping', (_req, res) => res.json({ ok: true }));
app.use('/api/auth',     authRoutes);
app.use('/api/tenants',  tenantRoutes);
app.use('/api/settings', settingsRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  logger.info(`Abyte ERP Admin Panel backend started on port ${PORT}`);
});
