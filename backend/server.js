// ── DNS fix for MongoDB Atlas SRV on Windows ───────────────────────────────
// Node.js built-in resolver cannot do SRV lookups on Windows.
// Must be called BEFORE any mongoose/mongodb imports.
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
if (!process.env.MONGO_URI) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
}
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { authMiddleware } = require('./middleware/auth');
const authRoutes       = require('./routes/auth');
const inspectionRoutes = require('./routes/inspections');

const app  = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/pomegranate_db';

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(authMiddleware);

// ── Rate limiting (express-rate-limit v7) ──────────────────────────────────
const limiter = rateLimit({
  windowMs:        15 * 60 * 1000,   // 15 minutes
  max:             200,
  standardHeaders: true,             // Return rate limit info in RateLimit-* headers
  legacyHeaders:   false,            // Disable the X-RateLimit-* headers
});
app.use('/api', limiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/inspections', inspectionRoutes);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:     'ok',
  uptime:     process.uptime(),
  mongoState: mongoose.connection.readyState,
  mongoStateText: ['disconnected','connected','connecting','disconnecting'][mongoose.connection.readyState] || 'unknown',
  timestamp:  new Date().toISOString(),
}));

// ── 404 fallback ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── MongoDB connect then start ─────────────────────────────────────────────
const server = app.listen(PORT, () =>
  console.log('[server] listening on port ' + PORT)
);

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS:          45000,
  maxPoolSize:              10,
  minPoolSize:              2,
})
  .then(() => {
    console.log('[mongo] connected to ' + MONGO_URI.replace(/:[^:@]+@/, ':****@'));
  })
  .catch(err => {
    console.error('[mongo] Atlas connection warning:', err.message);
  });

// Graceful shutdown
const shutdown = (signal) => {
  console.log('[server] ' + signal + ' received, shutting down...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('[server] closed.');
      process.exit(0);
    });
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
