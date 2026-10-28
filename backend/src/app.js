const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const accountsRouter = require('./routes/accounts');
const transfersRouter = require('./routes/transfers');
const statsRouter = require('./routes/stats');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * CORS_ORIGIN is "*" or a comma-separated list of origins. An entry may contain
 * "*" as a wildcard, e.g. "https://ledger-*.vercel.app" for Vercel preview deployments.
 */
function corsOptions(origin) {
  if (origin.trim() === '*') return { origin: true };
  const allowed = origin
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map((o) =>
      o.includes('*') ? new RegExp(`^${o.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^.]*')}$`) : o,
    );
  return { origin: allowed };
}

function createApp({ corsOrigin = config.corsOrigin } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(corsOrigin)));
  app.use(express.json({ limit: '100kb' }));

  const health = (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'connected' : 'disconnected' });
  };
  app.get('/health', health);
  // Same check for the browser: some ad blockers block URLs ending in /health.
  app.get('/api/status', health);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transfers', transfersRouter);
  app.use('/api/stats', statsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
