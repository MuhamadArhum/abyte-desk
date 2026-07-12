module.exports = {
  apps: [
    // ── Main API (cluster — 2 workers, zero-downtime reload) ──
    {
      name:    'abyte-main-api',
      script:  './backend/server.js',
      cwd:     '/var/www/AByte-POS/main-app',
      node_args: '--env-file=/var/www/AByte-POS/main-app/backend/.env.production',

      exec_mode: 'cluster',
      instances: process.env.API_INSTANCES || 2,

      // PM2 waits for process.send('ready') before routing traffic (zero-downtime)
      wait_ready:     true,
      listen_timeout: 10000,   // ms to wait for 'ready' signal
      kill_timeout:   30000,   // ms before SIGKILL after SIGTERM (matches gracefulShutdown timeout)
      shutdown_with_message: true,

      env_production: { NODE_ENV: 'production' },

      autorestart:        true,
      max_memory_restart: '500M',
      restart_delay:      2000,
      exp_backoff_restart_delay: 500,

      error_file:      '/var/log/pm2/abyte-main-error.log',
      out_file:        '/var/log/pm2/abyte-main-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      true,
    },

    // ── Email Queue Worker (standalone, single instance) ─────
    {
      name:    'abyte-email-worker',
      script:  './backend/workers/emailWorker.js',
      cwd:     '/var/www/AByte-POS/main-app',
      node_args: '--env-file=/var/www/AByte-POS/main-app/backend/.env.production',

      exec_mode:          'fork',
      instances:          1,
      autorestart:        true,
      max_memory_restart: '200M',
      restart_delay:      3000,

      // Only start worker when Redis is configured
      // If REDIS_URL is missing the worker exits immediately with a clear error
      env_production: { NODE_ENV: 'production' },

      error_file:      '/var/log/pm2/abyte-email-worker-error.log',
      out_file:        '/var/log/pm2/abyte-email-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
