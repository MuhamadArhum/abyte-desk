// emailWorker.js - BullMQ worker for the 'email' queue
//
// Run standalone:  node workers/emailWorker.js
// Or start via PM2 ecosystem (see ecosystem.config.js)
//
// Job names handled:
//   send            – generic sendMail payload
//   lowStockAlert   – sendLowStockAlert
//   saleConfirmation– sendSaleConfirmation
//   backupNotification – sendBackupNotification
//   loginAlert      – sendLoginAlert
//   invoiceEmail    – sendInvoiceEmail
//   passwordReset   – sendPasswordReset

require('dotenv').config({
  path: require('path').join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const { Worker } = require('bullmq');
const logger     = require('../config/logger');
const email      = require('../services/emailService');
const { incQueueJob } = require('../services/metricsService');
const { getConnection } = require('../services/queueService');

const QUEUE_NAME = 'email';

const HANDLERS = {
  send:                 (d) => email.sendMail ? email.sendMail(d) : Promise.resolve(),
  lowStockAlert:        (d) => email.sendLowStockAlert(d),
  saleConfirmation:     (d) => email.sendSaleConfirmation(d),
  backupNotification:   (d) => email.sendBackupNotification(d),
  loginAlert:           (d) => email.sendLoginAlert(d),
  invoiceEmail:         (d) => email.sendInvoiceEmail(d),
  passwordReset:        (d) => email.sendPasswordReset(d),
};

const conn = getConnection();
if (!conn) {
  logger.error('[EmailWorker] REDIS_URL is not set — worker cannot start');
  process.exit(1);
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    logger.info(`[EmailWorker] Processing job`, { id: job.id, name: job.name });
    const handler = HANDLERS[job.name];
    if (!handler) throw new Error(`Unknown email job: ${job.name}`);
    await handler(job.data);
    incQueueJob(QUEUE_NAME, 'completed');
  },
  {
    connection: conn,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  logger.info(`[EmailWorker] Job completed`, { id: job.id, name: job.name });
});

worker.on('failed', (job, err) => {
  logger.error(`[EmailWorker] Job failed`, { id: job?.id, name: job?.name, error: err.message, attempts: job?.attemptsMade });
  incQueueJob(QUEUE_NAME, 'failed');
});

worker.on('error', (err) => {
  logger.error(`[EmailWorker] Worker error`, { error: err.message });
});

logger.info(`[EmailWorker] Started — listening on queue "${QUEUE_NAME}"`);

// Graceful shutdown
const shutdown = async () => {
  logger.info('[EmailWorker] Shutting down...');
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
